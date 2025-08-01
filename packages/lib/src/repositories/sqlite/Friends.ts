import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Attempt, friends, ownedGames, users } from "../..";
import { SteamFriendUser } from "../../models";
import type { SteamUserRaw } from "../../models/SteamUser";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type ComposableRepository,
    type QueryComposer,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import type { UserRepository } from "./User";
import { safeInsert } from "./utils";

type FriendsSortMethod = "id" | "friend_since";

interface FriendsSortFilters {
    id: string;
}

class FriendsQueryComposer implements QueryComposer<SteamFriendUser, FriendsSortMethod> {
    private userIds = new Set<string>();

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private db: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
        private userRepository: UserRepository,
    ) {}

    /**
     * Filter by a single user ID whose friends we want to get
     */
    withUserIds(userId: string | Iterable<string>): this {
        if (typeof userId === "string") {
            this.userIds.add(userId);
        } else {
            for (const id of userId) {
                this.userIds.add(id);
            }
        }

        return this;
    }

    /**
     * Build and execute the composed query
     */
    async build(
        options: ComposableQueryOptions<FriendsSortMethod> = {},
    ): Promise<ComposableQueryResult<SteamFriendUser>> {
        // Ensure data exists first
        // Note: Database errors should bubble up, API errors are handled internally
        await this.ensureDataExists();

        // Execute main query
        const results = await this.executeMainQuery(options);

        return createQueryResult(results, options.cursor);
    }

    /**
     * Ensure friend data exists in the database, fetching from API if needed
     */
    private async ensureDataExists(): Promise<void> {
        if (this.userIds.size === 0) return;

        const ids = Array.from(this.userIds);

        // First ensure main users exist in the users table
        console.log(`👤 Ensuring ${ids.length} main users exist in database`);
        const userEnsureResult = await this.userRepository.compose().withUserIds(ids).ensureDataExists();
        if (userEnsureResult.error) {
            console.warn("Failed to ensure users exist for friends query:", userEnsureResult.error);
        }

        // Fetch summary to figure out what friends data is missing
        // This is consumer-controlled (friends composer controls user IDs), so inArray is safe
        const existingFriendsUsers = await this.db
            .selectDistinct({ user_id: friends.user_id })
            .from(friends)
            .where(inArray(friends.user_id, ids));

        const existingUserIds = new Set(existingFriendsUsers.map((r) => r.user_id));
        const missingUserIds = new Set(ids.filter((id) => !existingUserIds.has(id)));

        // Fetch friends lists for users that don't have friends data yet
        if (missingUserIds.size !== 0) {
            console.log(`📱 Fetching friends lists for ${missingUserIds.size} users:`, Array.from(missingUserIds));

            // Fetch friends lists from Steam API
            const friendsListData = await Attempt.all(
                Array.from(missingUserIds).map(async (userId) => {
                    const result = await this.steamApi.getFriendsList({
                        steamid: userId,
                        relationship: "friend",
                    });
                    return { userId, friendsList: result.friendslist.friends };
                }),
            );

            if (friendsListData.error) {
                console.warn("Failed to fetch some friends lists:", friendsListData.error);
            }

            if (friendsListData.data) {
                // Collect all unique friend IDs
                const allFriendIds = new Set<string>();
                const friendsToInsert = friendsListData.data.flatMap((r) => {
                    if (r === undefined) return []; // Skip undefined results
                    const { userId, friendsList } = r;
                    return friendsList.map((friend) => {
                        allFriendIds.add(friend.steamid);
                        return {
                            user_id: userId,
                            friend_id: friend.steamid,
                            friend_since: new Date(friend.friend_since * 1000), // Convert Unix timestamp to Date
                        };
                    });
                });

                // Ensure all friend users exist in the users table AFTER inserting friend relationships
                // First, insert friend relationships to avoid parameter explosion in user data fetching
                if (friendsToInsert.length > 0) {
                    console.log(`� Inserting ${friendsToInsert.length} friend relationships`);
                    await safeInsert(
                        this.db,
                        friendsToInsert,
                        (friendsBatch) => this.db.insert(friends).values(friendsBatch).onConflictDoNothing(), // Don't update existing friendships
                    );
                }

                // Now ensure friend users exist using subquery from friends table (avoids parameter explosion)
                if (allFriendIds.size > 0) {
                    console.log(`👥 Ensuring ${allFriendIds.size} friend users exist in database using subquery`);

                    // Create subquery for friend user IDs from the friends table we just populated
                    const friendUserIdsSubquery = sql`(
                        SELECT DISTINCT friend_id AS user_id 
                        FROM friends 
                        WHERE user_id IN (${sql.join(Array.from(this.userIds), sql`, `)})
                    )`;

                    const friendUsersResult = await this.userRepository
                        .compose()
                        .withRequiredEntitySubquery("user", friendUserIdsSubquery)
                        .ensureDataExists();

                    if (friendUsersResult.error) {
                        console.warn("Some friend users could not be fetched:", friendUsersResult.error);
                    }
                }
            }
        }
    }

    /**
     * Execute the main friends query
     */
    private async executeMainQuery(options: ComposableQueryOptions<FriendsSortMethod>): Promise<SteamFriendUser[]> {
        if (this.userIds.size === 0) {
            return [];
        }

        const ids = Array.from(this.userIds);

        // Get friends data first - consumer-controlled user IDs, so inArray is safe
        const friendUsers = await this.db
            .selectDistinct({
                id: friends.user_id,
                friend_id: friends.friend_id,
            })
            .from(friends)
            .where(inArray(friends.user_id, ids));

        // Get users for friends
        const friendsToFetch = new Set(friendUsers.map((f) => f.friend_id));
        const sortMethod =
            options.sort?.method === "friend_since" ? sql`${friends.friend_since}` : sql`${friends.friend_id}`;
        const sortDirection = options.sort?.direction !== "desc" ? desc : asc;

        // Create a subquery for the friend user IDs we need instead of using explicit IDs
        // This avoids parameter explosion when there are many friends
        const friendUserIdsSubquery = sql`
            SELECT DISTINCT ${friends.friend_id} as user_id 
            FROM ${friends} 
            WHERE ${inArray(friends.user_id, ids)}
        `;

        const friendUsersEnsureResult = await this.userRepository
            .compose()
            .withRequiredEntitySubquery("user", friendUserIdsSubquery)
            .ensureDataExists();
        if (friendUsersEnsureResult.error) {
            console.warn("Failed to ensure friend user data exists:", friendUsersEnsureResult.error);
        }

        // Fetch original users for mapping
        const originalUsersResponse = await this.userRepository
            .compose()
            .withUserIds(ids)
            .build({
                sort: { method: "id", direction: "asc" },
                limit: ids.length,
            });

        if (!originalUsersResponse.data) {
            return [];
        }

        const originalUsersMap = new Map(originalUsersResponse.data.map((u) => [u.serialize().data.steamid, u]));

        // Build main query with pagination and owned games in a single query to avoid parameter explosion
        // Use SQL-level pagination instead of application-level pagination
        const friendsWithGamesQuery = this.db
            .select({
                userId: friends.user_id,
                friendId: users.id,
                userData: users.data,
                friendSince: friends.friend_since,
                updatedAt: users.updated_at,
                // Owned games data
                gameUserId: ownedGames.user_id,
                appId: ownedGames.app_id,
                playtime2weeks: ownedGames.playtime_2w_minutes,
                playtimeForever: ownedGames.playtime_total_minutes,
                rtimeLastPlayed: ownedGames.last_played_at,
            })
            .from(friends)
            .innerJoin(users, eq(users.id, friends.friend_id))
            .leftJoin(ownedGames, eq(ownedGames.user_id, friends.friend_id))
            .where(inArray(friends.user_id, ids))
            .orderBy(sortDirection(sortMethod))
            .limit(options.limit || 1000)
            .offset(options.cursor || 0);

        const allRows = await friendsWithGamesQuery;

        // Group the results by friend
        const friendsMap = new Map<
            string,
            {
                userId: string;
                friendId: string;
                userData: SteamUserRaw;
                friendSince: Date;
                updatedAt: Date;
                ownedGames: Array<{
                    appId: number;
                    playtime2weeks: number | null;
                    playtimeForever: number | null;
                    rtimeLastPlayed: Date | null;
                }>;
            }
        >();

        for (const row of allRows) {
            if (!friendsMap.has(row.friendId)) {
                friendsMap.set(row.friendId, {
                    userId: row.userId,
                    friendId: row.friendId,
                    userData: row.userData,
                    friendSince: row.friendSince,
                    updatedAt: row.updatedAt,
                    ownedGames: [],
                });
            }

            const friend = friendsMap.get(row.friendId);
            if (!friend) throw new Error(`Friend ${row.friendId} not found in map`);
            if (row.appId !== null) {
                friend.ownedGames.push({
                    appId: row.appId,
                    playtime2weeks: row.playtime2weeks,
                    playtimeForever: row.playtimeForever,
                    rtimeLastPlayed: row.rtimeLastPlayed,
                });
            }
        }

        const friendRows = Array.from(friendsMap.values());

        const items = friendRows.map((row) => {
            const originalUser = originalUsersMap.get(row.userId);
            if (!originalUser) throw new Error(`Original user ${row.userId} missing`);

            // Transform owned games data to match OwnedGame<false> format
            const ownedApps = row.ownedGames.map((game) => ({
                appid: game.appId,
                playtime_2weeks: game.playtime2weeks ?? undefined,
                playtime_forever: game.playtimeForever ?? undefined,
                rtime_last_played: game.rtimeLastPlayed ? Math.floor(game.rtimeLastPlayed.getTime() / 1000) : undefined,
            }));

            return new SteamFriendUser({
                data: row.userData,
                ownedApps,
                friend: originalUser,
                friendData: {
                    steamid: row.friendId,
                    relationship: "friend",
                    friend_since: row.friendSince.getTime(),
                },
            });
        });

        return items;
    }
}

export class FriendsRepository
    implements
        Repository<SteamFriendUser, FriendsSortFilters, FriendsSortMethod>,
        ComposableRepository<SteamFriendUser, FriendsSortMethod, FriendsQueryComposer>
{
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private sqlite: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
        private userRepository: UserRepository,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): FriendsQueryComposer {
        return new FriendsQueryComposer(this.sqlite, this.steamApi, this.userRepository);
    }
}

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Attempt, friends, ownedGames, users } from "../..";
import { SteamFriendUser } from "../../models";
import { generateTimingId } from "../../utils/timing";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type ComposableRepository,
    type QueryComposer,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import { type UserRepository, upsertUsers } from "./User";
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
        const timingId = generateTimingId();
        console.time(`${timingId} FriendsQueryComposer.build`);

        // Ensure data exists first
        let accumulatedError: Error | null = null;

        try {
            await this.ensureDataExists();
        } catch (error) {
            accumulatedError = error as Error;
            console.warn("Failed to ensure all friend data exists, continuing with existing data:", error);
        }

        // Execute main query
        const results = await this.executeMainQuery(options);

        console.timeEnd(`${timingId} FriendsQueryComposer.build`);
        return createQueryResult(results, options.cursor, accumulatedError);
    }

    /**
     * Ensure friend data exists in the database, fetching from API if needed
     */
    private async ensureDataExists(): Promise<void> {
        if (this.userIds.size === 0) return;

        const timingId = generateTimingId();
        console.time(`${timingId} FriendsQueryComposer.ensureDataExists`);

        const ids = Array.from(this.userIds);

        // First ensure main users exist in the users table
        console.log(`👤 Ensuring ${ids.length} main users exist in database`);
        await upsertUsers(this.db, this.steamApi, ids);

        // Fetch summary to figure out what friends data is missing - chunk to avoid parameter limits
        const friendUsers = [];
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const chunkResults = await this.db
                .selectDistinct({
                    id: friends.user_id,
                    friend_id: friends.friend_id,
                })
                .from(friends)
                .where(inArray(friends.user_id, chunk));
            friendUsers.push(...chunkResults);
        }

        const presentUserIds = new Set(friendUsers.map((e) => e.id));
        const missingUserIds = new Set(ids).difference(presentUserIds);

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
                const friendsToInsert = friendsListData.data.flatMap(({ userId, friendsList }) => {
                    return friendsList.map((friend) => {
                        allFriendIds.add(friend.steamid);
                        return {
                            user_id: userId,
                            friend_id: friend.steamid,
                            friend_since: new Date(friend.friend_since * 1000), // Convert Unix timestamp to Date
                        };
                    });
                });

                // Ensure all friend users exist in the users table BEFORE inserting friend relationships
                if (allFriendIds.size > 0) {
                    console.log(`� Ensuring ${allFriendIds.size} friend users exist in database`);
                    await upsertUsers(this.db, this.steamApi, Array.from(allFriendIds));
                }

                // Now insert friend relationships (foreign keys should be satisfied)
                if (friendsToInsert.length > 0) {
                    console.log(`💾 Inserting ${friendsToInsert.length} friend relationships`);
                    await safeInsert(
                        this.db,
                        friendsToInsert,
                        (friendsBatch) => this.db.insert(friends).values(friendsBatch).onConflictDoNothing(), // Don't update existing friendships
                    );
                }
            }
        }

        console.timeEnd(`${timingId} FriendsQueryComposer.ensureDataExists`);
    }

    /**
     * Execute the main friends query
     */
    private async executeMainQuery(options: ComposableQueryOptions<FriendsSortMethod>): Promise<SteamFriendUser[]> {
        const timingId = generateTimingId();
        console.time(`${timingId} FriendsQueryComposer.executeMainQuery`);

        if (this.userIds.size === 0) {
            console.timeEnd(`${timingId} FriendsQueryComposer.executeMainQuery`);
            return [];
        }

        const ids = Array.from(this.userIds);

        // Get friends data first - chunk the query to avoid parameter limits
        const friendUsers = [];
        const CHUNK_SIZE = 100;
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const chunkResults = await this.db
                .selectDistinct({
                    id: friends.user_id,
                    friend_id: friends.friend_id,
                })
                .from(friends)
                .where(inArray(friends.user_id, chunk));
            friendUsers.push(...chunkResults);
        }

        // Get users for friends
        const friendsToFetch = new Set(friendUsers.map((f) => f.friend_id));
        const sortMethod =
            options.sort?.method === "friend_since" ? sql`${friends.friend_since}` : sql`${friends.friend_id}`;
        const sortDirection = options.sort?.direction !== "desc" ? desc : asc;

        await upsertUsers(this.db, this.steamApi, Array.from(friendsToFetch));

        // Fetch original users for mapping
        const originalUsersResponse = await this.userRepository
            .compose()
            .withUserIds(ids)
            .build({
                sort: { method: "id", direction: "asc" },
                limit: ids.length,
            });

        if (!originalUsersResponse.data) {
            console.timeEnd(`${timingId} FriendsQueryComposer.executeMainQuery`);
            return [];
        }

        const originalUsersMap = new Map(originalUsersResponse.data.map((u) => [u.serialize().data.steamid, u]));

        // Build main query with pagination - chunk to avoid parameter limits
        const allFriendRows = [];
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
            const chunk = ids.slice(i, i + CHUNK_SIZE);
            const friendQuery = this.db
                .select({
                    userId: friends.user_id,
                    friendId: users.id,
                    userData: users.data,
                    friendSince: friends.friend_since,
                    updatedAt: users.updated_at,
                })
                .from(friends)
                .innerJoin(users, eq(users.id, friends.friend_id))
                .where(inArray(friends.user_id, chunk))
                .orderBy(sortDirection(sortMethod))
                .$dynamic();

            const chunkResults = await friendQuery;
            allFriendRows.push(...chunkResults);
        }

        // Apply pagination to the combined results
        const startIndex = options.cursor || 0;
        const endIndex = options.limit ? startIndex + options.limit : allFriendRows.length;
        const friendRows = allFriendRows.slice(startIndex, endIndex);

        // Get the friend IDs from the results
        const limitedFriendIds = friendRows.map((row) => row.friendId);

        // Then get all owned games for these friends - chunk to avoid parameter limits
        const ownedGamesRows = [];
        if (limitedFriendIds.length > 0) {
            for (let i = 0; i < limitedFriendIds.length; i += CHUNK_SIZE) {
                const chunk = limitedFriendIds.slice(i, i + CHUNK_SIZE);
                const chunkResults = await this.db
                    .select({
                        userId: ownedGames.user_id,
                        appId: ownedGames.app_id,
                        playtime2weeks: ownedGames.playtime_2w_minutes,
                        playtimeForever: ownedGames.playtime_total_minutes,
                        rtimeLastPlayed: ownedGames.last_played_at,
                    })
                    .from(ownedGames)
                    .where(inArray(ownedGames.user_id, chunk));
                ownedGamesRows.push(...chunkResults);
            }
        }

        // Group owned games by user ID
        const ownedGamesByUser = new Map<string, typeof ownedGamesRows>();
        for (const game of ownedGamesRows) {
            if (!ownedGamesByUser.has(game.userId)) {
                ownedGamesByUser.set(game.userId, []);
            }
            const userGames = ownedGamesByUser.get(game.userId);
            if (userGames) {
                userGames.push(game);
            }
        }

        const items = friendRows.map((row) => {
            const originalUser = originalUsersMap.get(row.userId);
            if (!originalUser) throw new Error(`Original user ${row.userId} missing`);

            // Transform owned games data to match OwnedGame<false> format
            const userOwnedGames = ownedGamesByUser.get(row.friendId) || [];
            const ownedApps = userOwnedGames.map((game) => ({
                appid: game.appId,
                playtime_2weeks: game.playtime2weeks ?? undefined,
                playtime_forever: game.playtimeForever ?? undefined,
                rtime_last_played: game.rtimeLastPlayed ? Math.floor(game.rtimeLastPlayed.getTime() / 1000) : undefined,
            }));

            return new SteamFriendUser({
                data: row.userData,
                ownedApps,
                friend: originalUser,
                friendData: { steamid: row.friendId, relationship: "friend", friend_since: row.friendSince.getTime() },
            });
        });

        console.timeEnd(`${timingId} FriendsQueryComposer.executeMainQuery`);
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

import { asc, desc, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { Attempt, type SteamAuthenticatedAPIClient, ownedGames, users } from "../..";
import { SteamUser, type SteamUserRaw } from "../../models";
import { generateTimingId } from "../../utils/timing";
import type { OwnedGame } from "../api/steampowered/owned";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type ComposableRepository,
    type QueryComposer,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import { safeInsert } from "./utils";

type UserSortMethod = "id";

interface UserSortFilters {
    id: string;
}

class UserQueryComposer implements QueryComposer<SteamUser, UserSortMethod> {
    private userIds = new Set<string>();

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private db: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
    ) {}

    /**
     * Filter by specific user IDs
     */
    withUserIds(userIds: string | Iterable<string>): this {
        if (typeof userIds === "string") {
            this.userIds.add(userIds);
        } else {
            for (const id of userIds) {
                this.userIds.add(id);
            }
        }

        return this;
    }

    /**
     * Build and execute the composed query
     */
    async build(options: ComposableQueryOptions<UserSortMethod> = {}): Promise<ComposableQueryResult<SteamUser>> {
        const timingId = generateTimingId();
        console.time(`${timingId} UserQueryComposer.build`);

        let accumulatedError: Error | null = null;

        // Ensure data exists first
        try {
            await this.ensureDataExists();
        } catch (error) {
            accumulatedError = error as Error;
            console.warn("Failed to ensure all user data exists, continuing with existing data:", error);
        }

        // Execute main query
        let results: SteamUser[];
        try {
            results = await this.executeMainQuery(options);
        } catch (error) {
            if (accumulatedError) {
                console.warn("Additional error during User query:", error);
            } else {
                accumulatedError = error as Error;
            }
            console.warn("Error during User query, returning partial results:", error);
            results = []; // Return empty results on error
        }

        console.timeEnd(`${timingId} UserQueryComposer.build`);

        return createQueryResult(results, options.cursor, accumulatedError);
    }

    /**
     * Ensure user data exists in the database, fetching from API if needed
     */
    private async ensureDataExists(): Promise<void> {
        if (this.userIds.size === 0) return;

        const timingId = generateTimingId();
        console.time(`${timingId} UserQueryComposer.ensureDataExists`);

        const upsertResult = await upsertUsers(this.db, this.steamApi, Array.from(this.userIds));
        if (upsertResult.error) {
            console.warn("Error upserting users:", upsertResult.error);
        }

        console.timeEnd(`${timingId} UserQueryComposer.ensureDataExists`);
    }

    /**
     * Execute the main user query
     */
    private async executeMainQuery(options: ComposableQueryOptions<UserSortMethod>): Promise<SteamUser[]> {
        const timingId = generateTimingId();
        console.time(`${timingId} UserQueryComposer.executeMainQuery`);

        const sortDir = options.sort?.direction === "desc" ? desc : asc;
        const sortMethod = users.id; // Currently only "id" is supported

        // First, get the paginated users
        let userQuery = this.db
            .select({
                id: users.id,
                data: users.data,
            })
            .from(users)
            .orderBy(sortDir(sortMethod))
            .$dynamic();

        // Apply user ID filtering
        if (this.userIds.size > 0) {
            userQuery = userQuery.where(inArray(users.id, Array.from(this.userIds)));
        }

        // Apply pagination to users only
        if (options.limit !== undefined) {
            userQuery = userQuery.limit(options.limit);
        }
        if (options.cursor !== undefined) {
            userQuery = userQuery.offset(options.cursor);
        }

        const userRows = await userQuery;

        // If no users found, return empty array
        if (userRows.length === 0) {
            console.timeEnd(`${timingId} UserQueryComposer.executeMainQuery`);
            return [];
        }

        // Now get all owned games for these users using a subquery to avoid parameter limits
        const userIds = userRows.map((u) => u.id);
        const ownedGamesQuery = this.db
            .select({
                user_id: ownedGames.user_id,
                app_id: ownedGames.app_id,
                playtime_total_minutes: ownedGames.playtime_total_minutes,
                playtime_2w_minutes: ownedGames.playtime_2w_minutes,
                last_played_at: ownedGames.last_played_at,
            })
            .from(ownedGames)
            .where(inArray(ownedGames.user_id, userIds))
            .orderBy(asc(ownedGames.user_id), asc(ownedGames.app_id));

        const ownedGamesRows = await ownedGamesQuery;

        // Group results by user_id and construct SteamUser objects
        const userMap = new Map<string, { data: SteamUserRaw; ownedApps: OwnedGame<false>[] }>();

        // Initialize all users in the map
        for (const userRow of userRows) {
            userMap.set(userRow.id, {
                data: userRow.data,
                ownedApps: [],
            });
        }

        // Add owned games to their respective users
        for (const gameRow of ownedGamesRows) {
            const user = userMap.get(gameRow.user_id);
            if (user) {
                user.ownedApps.push({
                    appid: gameRow.app_id,
                    playtime_forever: gameRow.playtime_total_minutes ?? undefined,
                    playtime_2weeks: gameRow.playtime_2w_minutes ?? undefined,
                    rtime_last_played: gameRow.last_played_at ? gameRow.last_played_at.getTime() / 1000 : undefined, // Convert to seconds
                });
            }
        }

        // Convert map to SteamUser objects
        const userResults = Array.from(userMap.values()).map(
            ({ data, ownedApps }) => new SteamUser({ data, ownedApps }),
        );

        console.timeEnd(`${timingId} UserQueryComposer.executeMainQuery`);
        return userResults;
    }
}

export class UserRepository
    implements
        Repository<SteamUser, UserSortFilters, UserSortMethod>,
        ComposableRepository<SteamUser, UserSortMethod, UserQueryComposer>
{
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private sqlite: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): UserQueryComposer {
        return new UserQueryComposer(this.sqlite, this.steamApi);
    }
}

export const upsertUsers = async (
    // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
    sqlite: DrizzleD1Database<any>,
    steamApi: SteamAuthenticatedAPIClient,
    ids: string[],
) => {
    // Fetch summary to figure out what's missing using chunked queries to avoid parameter limit
    const CHUNK_SIZE = 100; // Conservative chunk size for SQLite parameters
    const allExistingUserRows = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const chunkResults = await sqlite.selectDistinct({ id: users.id }).from(users).where(inArray(users.id, chunk));
        allExistingUserRows.push(...chunkResults);
    }
    const existingUserRows = allExistingUserRows;

    // Create sets for easy comparison
    const requestedIds = new Set(ids);
    const presentUserIds = new Set(existingUserRows.map((e) => e.id));
    const missingUserIds = requestedIds.difference(presentUserIds);

    if (missingUserIds.size !== 0) console.debug(`Missing users: ${missingUserIds.size}`);

    let accumulatedError: Error | null = null;

    // Fetch user details for missing IDs
    if (missingUserIds.size !== 0) {
        const validData = [];
        // Get all missing user data in batches to avoid API limits
        const missingUserIdsArray = missingUserIds.values().toArray();

        const missingPlayerSummaries = await Attempt.try(() => {
            return steamApi.getPlayerSummaries(missingUserIdsArray);
        });
        if (!accumulatedError && missingPlayerSummaries.error) accumulatedError = missingPlayerSummaries.error;

        const missingOwnedGames = await Attempt.all(
            missingUserIdsArray.map((userId) => {
                return steamApi
                    .getOwnedGames({ steamid: userId, include_played_free_games: true })
                    .then((d) => (d && "games" in d.response && d.response.games ? d.response.games : []))
                    .then((d) => ({ user: userId, games: d }));
            }),
        );
        if (!accumulatedError && missingOwnedGames.error) accumulatedError = missingOwnedGames.error;

        for (const userId of missingUserIds) {
            const userData = missingPlayerSummaries.data?.response.players.find((u) => u.steamid === userId);
            const ownedGamesData = missingOwnedGames.data.find((o) => o.user === userId);

            if (userData) {
                validData.push({
                    id: userData.steamid,
                    user: userData,
                    ownedGames: ownedGamesData ? ownedGamesData.games : [],
                });
            }
        }

        console.debug(`Users to insert: ${validData.length}`);

        // Insert missing data into the database
        await safeInsert(sqlite, validData, (u) =>
            sqlite
                .insert(users)
                .values(
                    u.map((data) => ({
                        id: data.id,
                        data: data.user,
                        updated_at: new Date(),
                    })),
                )
                .onConflictDoUpdate({
                    target: users.id,
                    set: {
                        data: users.data,
                        updated_at: new Date(),
                    },
                }),
        );
        await safeInsert(
            sqlite,
            validData.flatMap((d) =>
                d.ownedGames.map((g) => ({
                    user_id: d.id,
                    ownedGames: g,
                })),
            ),
            (u) =>
                sqlite
                    .insert(ownedGames)
                    .values(
                        u.map((data) => ({
                            user_id: data.user_id,
                            app_id: data.ownedGames.appid,
                            last_played_at: data.ownedGames.rtime_last_played
                                ? new Date(data.ownedGames.rtime_last_played * 1000) // Convert seconds to milliseconds
                                : null,
                            playtime_2w_minutes: data.ownedGames.playtime_2weeks ?? null,
                            playtime_total_minutes: data.ownedGames.playtime_forever ?? null,
                        })),
                    )
                    .onConflictDoUpdate({
                        target: [ownedGames.user_id, ownedGames.app_id],
                        set: {
                            last_played_at: ownedGames.last_played_at,
                            playtime_2w_minutes: ownedGames.playtime_2w_minutes,
                            playtime_total_minutes: ownedGames.playtime_total_minutes,
                        },
                    }),
        );
    }

    return Attempt.fromSimple(null, accumulatedError);
};

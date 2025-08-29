import type { SQL } from "drizzle-orm";
import { asc, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import {
    Attempt,
    type AttemptStatus,
    type ProjectDB,
    type SteamAuthenticatedAPI,
    getFetchManager,
    ownedGames,
    users,
} from "../..";
import { SteamUser, type SteamUserRaw } from "../../models";
import type { OwnedGame } from "../api/steampowered/owned";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type ComposableRepository,
    type SubqueryConsumer,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import { safeInsert } from "./utils";

type UserSortMethod = "id";

interface UserSortFilters {
    id: string;
}

class UserQueryComposer implements SubqueryConsumer<SteamUser, UserSortMethod> {
    private userIds = new Set<string>();
    private requiredUserSubquery: SQL | undefined;

    constructor(
        private db: ProjectDB,
        private steamApi: SteamAuthenticatedAPI,
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
     * Accept a subquery that defines which user IDs are required
     */
    withRequiredEntitySubquery(entityType: string, subquery: SQL): this {
        if (entityType === "user") {
            this.requiredUserSubquery = subquery;
        }
        return this;
    }

    /**
     * Build and execute the composed query
     */
    async build(options: ComposableQueryOptions<UserSortMethod> = {}): Promise<ComposableQueryResult<SteamUser>> {
        // Ensure data exists first
        const ensureResult = await this.ensureDataExists();
        if (ensureResult.error) {
            console.warn("Failed to ensure all user data exists, continuing with existing data:", ensureResult.error);
        }

        // Execute main query
        let results: SteamUser[];
        let queryError: Error | null = null;
        try {
            results = await this.executeMainQuery(options);
        } catch (error) {
            queryError = error as Error;
            console.warn("Error during User query, returning partial results:", error);
            results = []; // Return empty results on error
        }

        // Combine errors using Attempt chaining
        const finalResult = ensureResult.and(Attempt.from(undefined, queryError));
        return createQueryResult(results, options.cursor, finalResult.error);
    }

    /**
     * Execute a COUNT over the logical result set produced by the current composition.
     * - Ensures data before read (calls ensureDataExists)
     * - Reuses the same filters as build(): withUserIds(); additionally, if a required-user subquery
     *   was provided, counts DISTINCT users present in that subquery intersected with existing users.
     * - No ordering or pagination; COUNT only.
     */
    async count(): Promise<Attempt<number, AttemptStatus>> {
        // Ensure-before-read: capture error but attempt COUNT regardless
        let ensureError: Error | null = null;
        try {
            const ensureRes = await this.ensureDataExists();
            ensureError = ensureRes.error;
        } catch (err) {
            ensureError = err as Error;
        }

        try {
            // If a required user subquery is specified, count distinct users in that subquery that exist in users
            if (this.requiredUserSubquery) {
                const requiredUsers = sql`(${this.requiredUserSubquery}) AS required_users`;

                // SELECT COUNT(DISTINCT users.id)
                // FROM (subquery) AS required_users
                // INNER JOIN users ON users.id = required_users.user_id
                // [AND users.id IN (...)] if withUserIds() was also provided
                let q = this.db
                    .select({
                        cnt: sql<number>`count(distinct ${users.id})`,
                    })
                    .from(requiredUsers)
                    .innerJoin(users, eq(users.id, sql`required_users.user_id`))
                    .$dynamic();

                if (this.userIds.size > 0) {
                    q = q.where(inArray(users.id, Array.from(this.userIds)));
                }

                const rows = await q;
                const cnt = rows[0]?.cnt ?? 0;
                return ensureError ? Attempt.partial(cnt, ensureError) : Attempt.ok(cnt);
            }

            // Otherwise, base count from users with optional explicit ID filter
            let q = this.db
                .select({
                    cnt: sql<number>`count(distinct ${users.id})`,
                })
                .from(users)
                .$dynamic();

            if (this.userIds.size > 0) {
                q = q.where(inArray(users.id, Array.from(this.userIds)));
            }

            const rows = await q;
            const cnt = rows[0]?.cnt ?? 0;
            return ensureError ? Attempt.partial(cnt, ensureError) : Attempt.ok(cnt);
        } catch (err) {
            return Attempt.fail<number>(err as Error);
        }
    }

    /**
     * Ensure user data exists in the database, fetching from API if needed
     */
    async ensureDataExists(): Promise<Attempt<void, AttemptStatus>> {
        // Find missing users using subquery pattern when available
        // Note: Database errors (SQL issues) should bubble up, not be caught
        const missingUserIds = await this.findMissingUsers();

        if (missingUserIds.length === 0) {
            return Attempt.ok(undefined);
        }

        // Fetch and insert missing user data
        // Note: API errors are handled inside fetchAndUpsertUsers, DB errors bubble up
        return await this.fetchAndUpsertUsers(missingUserIds);
    }

    /**
     * Find user IDs that are missing from the database
     */
    private async findMissingUsers(): Promise<string[]> {
        // Use subquery pattern when available, fall back to explicit IDs
        if (this.requiredUserSubquery) {
            // Find users that are required by the subquery but don't exist in the database
            const missingUsersQuery = this.db
                .select({ user_id: sql<string>`required_users.user_id` })
                .from(sql`(${this.requiredUserSubquery}) AS required_users`)
                .where(notExists(this.db.select().from(users).where(eq(users.id, sql`required_users.user_id`))));

            const result = await missingUsersQuery;
            return result.map((row) => row.user_id);
        }

        if (this.userIds.size > 0) {
            // Fall back to explicit ID checking (direct consumer-controlled usage)
            const existingUsersQuery = this.db
                .selectDistinct({ id: users.id })
                .from(users)
                .where(inArray(users.id, Array.from(this.userIds)));

            const existingUsers = await existingUsersQuery;
            const existingUserIds = new Set(existingUsers.map((u) => u.id));
            return Array.from(this.userIds).filter((id) => !existingUserIds.has(id));
        }

        return [];
    }

    /**
     * Fetch and upsert user data from Steam API
     */
    private async fetchAndUpsertUsers(missingUserIds: string[]): Promise<Attempt<void, AttemptStatus>> {
        if (missingUserIds.length === 0) {
            return Attempt.ok(undefined);
        }

        console.debug(`Missing users: ${missingUserIds.length}`);

        const validData = [];

        // Fetch user summaries
        const missingPlayerSummaries = await Attempt.try(() => {
            return this.steamApi.getPlayerSummaries(missingUserIds);
        });

        // Fetch owned games for each user
        getFetchManager().reset({ maxFetches: 150 }); // We'll say max 150 users for now (who am I kidding, I am making this up as I go)
        const missingOwnedGames = await Attempt.all(
            missingUserIds.map((userId) => {
                return this.steamApi
                    .getOwnedGames({ steamid: userId, include_played_free_games: true })
                    .then((d) => (d && "games" in d.response && d.response.games ? d.response.games : []))
                    .then((d) => ({ user: userId, games: d }));
            }),
        );

        // Combine user data
        for (const userId of missingUserIds) {
            const userData = missingPlayerSummaries.data?.response.players.find((u) => u.steamid === userId);
            const ownedGamesData = missingOwnedGames.data.find((o) => o?.user === userId);

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
        // Note: Database errors should bubble up, not be caught
        await Promise.all([
            safeInsert(this.db, validData, (u) =>
                this.db
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
                            data: sql`excluded.data`,
                            updated_at: new Date(),
                        },
                    }),
            ),
            safeInsert(
                this.db,
                validData.flatMap((d) =>
                    d.ownedGames.map((g) => ({
                        user_id: d.id,
                        ownedGames: g,
                    })),
                ),
                (u) =>
                    this.db
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
                                last_played_at: sql`excluded.last_played_at`,
                                playtime_2w_minutes: sql`excluded.playtime_last_two_weeks`,
                                playtime_total_minutes: sql`excluded.playtime_total`,
                            },
                        }),
            ),
        ]);

        // Combine errors from both API calls using Attempt chaining
        const combinedResult = missingPlayerSummaries.and(missingOwnedGames.map(() => undefined));
        return combinedResult;
    }

    /**
     * Execute the main user query
     */
    private async executeMainQuery(options: ComposableQueryOptions<UserSortMethod>): Promise<SteamUser[]> {
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
            return [];
        }

        // Now get all owned games for these users using a subquery to avoid parameter limits
        // Create a subquery that matches the same user filtering and pagination as the main query
        let userIdsSubquery = this.db.select({ id: users.id }).from(users).orderBy(sortDir(sortMethod)).$dynamic();

        // Apply the same user ID filtering as the main query
        if (this.userIds.size > 0) {
            userIdsSubquery = userIdsSubquery.where(inArray(users.id, Array.from(this.userIds)));
        }

        // Apply the same pagination as the main query
        if (options.limit !== undefined) {
            userIdsSubquery = userIdsSubquery.limit(options.limit);
        }
        if (options.cursor !== undefined) {
            userIdsSubquery = userIdsSubquery.offset(options.cursor);
        }

        const ownedGamesQuery = this.db
            .select({
                user_id: ownedGames.user_id,
                app_id: ownedGames.app_id,
                playtime_total_minutes: ownedGames.playtime_total_minutes,
                playtime_2w_minutes: ownedGames.playtime_2w_minutes,
                last_played_at: ownedGames.last_played_at,
            })
            .from(ownedGames)
            .where(inArray(ownedGames.user_id, userIdsSubquery))
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
        return userMap
            .values()
            .map(({ data, ownedApps }) => new SteamUser({ data, ownedApps }))
            .toArray();
    }
}

export class UserRepository
    implements
        Repository<SteamUser, UserSortFilters, UserSortMethod>,
        ComposableRepository<SteamUser, UserSortMethod, UserQueryComposer>
{
    constructor(
        private sqlite: ProjectDB,
        private steamApi: SteamAuthenticatedAPI,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): UserQueryComposer {
        return new UserQueryComposer(this.sqlite, this.steamApi);
    }
}

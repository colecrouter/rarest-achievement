import { type SQL, and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
    achievementsStats,
    apps,
    estimatedPlayers,
    friends,
    getLanguageByCode,
    ownedGames,
    userAchievements,
} from "../..";
import { Attempt, type AttemptStatus } from "../../error";
import type { APILanguageCode, LanguageCode } from "../../lang";
import { SteamApp, SteamUserAchievement } from "../../models";
import type { SteamAppRaw } from "../../models/SteamApp";
import { generateTimingId } from "../../utils/timing";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import {
    type ComposableQueryOptions,
    ComposableQueryResult,
    type ComposableRepository,
    type QueryComposer,
    createQueryResult,
} from "../composable";
import type { Repository, RepositoryParams, RepositorySort } from "../repository";
import type { AppAchievementRepository } from "./AppAchievement";
import type { UserRepository } from "./User";
import { upsertUsers } from "./User";
import { achievementsMeta } from "./schema";
import { safeInsert, searchTerms } from "./utils";

/**
 * UserAchievement Repository - Pure SQL Composition Architecture
 *
 * This repository has been completely rewritten to solve the "parameter explosion" problem
 * that was causing SQL query failures when trying to pass large arrays via `inArray()`.
 *
 * ## Key Design Principles:
 *
 * 1. **Pure SQL Composition**: All filtering is done via declarative SQL JOINs and WHERE
 *    clauses, eliminating the need to pass result arrays between queries.
 *
 * 2. **Parameter Safety**: Only top-level user input (appIds, userIds, achIds) are passed
 *    as direct parameters. All derived filters use JOINs or subqueries.
 *
 * 3. **Two Processing Modes**:
 *    - **Direct Mode**: Simple query with minimal JOINs for basic filtering
 *    - **Comprehensive Mode**: Single comprehensive SQL query with all metadata JOINs
 *
 * 4. **Composable Filters**: Each filter method adds SQL conditions without parameter explosion:
 *    - `withUserIds()` - Direct parameter passing (safe)
 *    - `withAppIds()` - Direct parameter passing (safe)
 *    - `withFriendsOf()` - Uses INNER JOIN on friends table (avoids fetching friend IDs)
 *    - `withSearch()` - Uses INNER JOIN on achievements_meta table
 *    - `withUnlockedStatus()` - Uses IS NULL/IS NOT NULL conditions
 *
 * ## How Parameter Explosion is Avoided:
 *
 * ### Before (Problematic):
 * ```typescript
 * // Step 1: Get all user's owned games OR friends
 * const ownedGameIds = await getOwnedGames(userId); // Returns 1000+ app IDs
 * const friendIds = await getFriendsUserIds(userId); // Returns 500+ friend IDs
 *
 * // Step 2: Pass those IDs to next query - FAILS due to SQL parameter limits
 * const achievements = await query.where(inArray(apps.id, ownedGameIds)); // 💥 FAILS
 * const friendAchievements = await query.where(inArray(userAchievements.user_id, friendIds)); // 💥 FAILS
 * ```
 *
 * ### After (Fixed):
 * ```typescript
 * // Single query with JOIN - no parameter explosion
 * const achievements = await db
 *   .select()
 *   .from(userAchievements)
 *   .innerJoin(ownedGames, eq(userAchievements.app_id, ownedGames.app_id)) // All owned games
 *   .innerJoin(friends, eq(friends.friend_id, userAchievements.user_id))   // All friends
 *   .where(eq(friends.user_id, userId)); // ✅ WORKS
 * ```
 *
 * ## Processing Mode Selection:
 *
 * - **Direct Mode**: Used for simple filtering with specific app IDs and no search/unlocked filters
 * - **Comprehensive Mode**: Used when:
 *   - Filtering by unlocked status (requires achievement metadata)
 *   - Using search functionality (requires achievement metadata)
 *   - No app IDs specified (requires "all owned games" logic)
 *
 * The comprehensive mode builds a single SQL query that includes all necessary JOINs to fetch
 * user achievements along with their metadata, completely eliminating the need for separate
 * AppAchievement repository calls and parameter passing.
 */

export type UserAchievementSortMethod = "rarity_pct" | "rarity_score" | "unlocked_at";

export interface UserAchievementFilters {
    appId?: number;
    achId?: string;
    userId: string;
}

export interface UserAchievementRepositoryParams<SortMethod extends UserAchievementSortMethod>
    extends RepositoryParams<UserAchievementFilters, SortMethod> {
    filters: {
        appId?: number[];
        achId?: string[];
        userId: string[];
    };
    sort: RepositorySort<SortMethod>;
    /** Number offset for pagination; null for first page */
    cursor?: number;
    limit?: number;
    search?: string;
    /** true/false = unlocked/locked achievements, undefined = all */
    unlocked?: boolean;
    lang: LanguageCode;
}

/**
 * Composable query builder for user achievements
 * Uses SQL composition with JOINs to avoid parameter explosion
 */
class UserAchievementQueryComposer implements QueryComposer<SteamUserAchievement, UserAchievementSortMethod> {
    private userIds: Set<string> = new Set();
    private appIds: Set<number> = new Set();
    private achievementIds: Set<string> = new Set();
    private friendsOfUserId?: string;
    private unlockedFilter?: boolean;
    private searchTerm?: string;
    private lang: LanguageCode = "en";

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private db: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
        private appAchievementRepository: AppAchievementRepository,
        private userRepository: UserRepository,
    ) {}

    /**
     * Set the language for this query
     */
    withLanguage(lang: LanguageCode): this {
        this.lang = lang;
        return this;
    }

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
     * Filter by specific app IDs
     */
    withAppIds(appIds: number | Iterable<number>): this {
        if (typeof appIds === "number") {
            this.appIds.add(appIds);
        } else {
            for (const id of appIds) {
                this.appIds.add(id);
            }
        }
        return this;
    }

    /**
     * Filter by specific achievement IDs
     */
    withAchievementIds(achievementIds: string | Iterable<string>): this {
        if (typeof achievementIds === "string") {
            this.achievementIds.add(achievementIds);
        } else {
            for (const id of achievementIds) {
                this.achievementIds.add(id);
            }
        }
        return this;
    }

    /**
     * Filter by friends of a specific user
     */
    withFriendsOf(userId: string): this {
        this.friendsOfUserId = userId;
        return this;
    }

    /**
     * Filter by unlocked status
     */
    withUnlockedStatus(unlocked?: boolean): this {
        this.unlockedFilter = unlocked;
        return this;
    }

    /**
     * Add search term for achievement names/descriptions
     */
    withSearch(search: string): this {
        this.searchTerm = search;
        return this;
    }

    /**
     * Build and execute the composed query
     */
    async build(
        options: ComposableQueryOptions<UserAchievementSortMethod> = {},
    ): Promise<ComposableQueryResult<SteamUserAchievement>> {
        const timingId = generateTimingId();
        console.time(`${timingId} UserAchievementQueryComposer.build`);

        // Check if we have any user filtering criteria
        if (this.userIds.size === 0 && !this.friendsOfUserId) {
            console.timeEnd(`${timingId} UserAchievementQueryComposer.build`);
            return createQueryResult([], options.cursor || 0);
        }

        // Determine processing mode based on filters
        const shouldUseComprehensiveSQL = this.shouldUseComprehensiveSQL();

        const resultsAttempt = await (shouldUseComprehensiveSQL
            ? this.executeWithComprehensiveSQL(options, timingId)
            : this.executeDirectQuery(options, timingId));

        console.timeEnd(`${timingId} UserAchievementQueryComposer.build`);
        return new ComposableQueryResult(
            resultsAttempt.hasData() ? resultsAttempt.data : [],
            (options.cursor || 0) + (resultsAttempt.hasData() ? resultsAttempt.data.length : 0),
            resultsAttempt.error,
        );
    }

    /**
     * Determine if we should use the comprehensive SQL approach
     * Use comprehensive SQL when:
     * 1. Filtering by unlocked status (more complex filtering)
     * 2. Using search functionality (needs achievement metadata)
     * 3. No explicit app IDs provided (would need "all owned games" logic)
     */
    private shouldUseComprehensiveSQL(): boolean {
        return this.unlockedFilter !== undefined || this.searchTerm !== undefined || this.appIds.size === 0;
    }

    /**
     * Execute using direct SQL query (for simple cases)
     */
    private async executeDirectQuery(
        options: ComposableQueryOptions<UserAchievementSortMethod>,
        timingId: string,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        console.time(`${timingId} UserAchievementQueryComposer.executeDirectQuery`);
        console.log("🚀 Using direct query processing");

        // Step 1: Determine actual user filtering approach
        const userFilterConditions: SQL[] = [];

        if (this.friendsOfUserId) {
            // Use JOIN with friends table instead of fetching friend IDs (avoids parameter explosion)
            // This will be handled in the main query JOIN, no separate userIds needed
        } else if (this.userIds.size > 0) {
            // Direct user IDs are safe as they're top-level parameters
            const ensureResult = await this.ensureUserDataExists();
            if (ensureResult.isError()) {
                console.timeEnd(`${timingId} UserAchievementQueryComposer.executeDirectQuery`);
                return Attempt.partial([], ensureResult.error);
            }
            const userIdsArray = this.userIds.values().toArray();
            userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
        } else {
            console.log("⚠️ No user filtering criteria provided");
            console.timeEnd(`${timingId} UserAchievementQueryComposer.executeDirectQuery`);
            return Attempt.ok([]);
        }

        // Step 2: Build and execute the main SQL query using Drizzle's proper JOIN syntax
        let query = this.db
            .select({
                user_id: userAchievements.user_id,
                app_id: userAchievements.app_id,
                ach_id: userAchievements.ach_id,
                unlocked_at: userAchievements.unlocked_at,
                rarity_pct: achievementsStats.percent,
            })
            .from(userAchievements)
            // JOIN to ensure user owns the game (avoids parameter explosion)
            .innerJoin(
                ownedGames,
                and(eq(userAchievements.user_id, ownedGames.user_id), eq(userAchievements.app_id, ownedGames.app_id)),
            )
            // LEFT JOIN for rarity data
            .leftJoin(
                achievementsStats,
                and(
                    eq(userAchievements.app_id, achievementsStats.app_id),
                    eq(userAchievements.ach_id, achievementsStats.ach_id),
                ),
            )
            // LEFT JOIN for estimated players (for rarity score calculation)
            .leftJoin(estimatedPlayers, eq(userAchievements.app_id, estimatedPlayers.app_id))
            .$dynamic();

        // Apply user filter (safe - these are top-level parameters)
        const whereConditions: Array<SQL | undefined> = [...userFilterConditions];

        // Apply specific filters (safe - these are also top-level parameters)
        if (this.appIds.size > 0) {
            whereConditions.push(inArray(userAchievements.app_id, Array.from(this.appIds)));
        }

        if (this.achievementIds.size > 0) {
            whereConditions.push(inArray(userAchievements.ach_id, Array.from(this.achievementIds)));
        }

        if (this.unlockedFilter !== undefined) {
            whereConditions.push(
                this.unlockedFilter ? isNotNull(userAchievements.unlocked_at) : isNull(userAchievements.unlocked_at),
            );
        }

        // Apply search filter using JOIN (avoids parameter explosion)
        if (this.searchTerm) {
            const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

            query = query.leftJoin(
                achievementsMeta,
                and(
                    eq(achievementsMeta.app_id, userAchievements.app_id),
                    eq(achievementsMeta.ach_id, userAchievements.ach_id),
                    eq(achievementsMeta.lang, apiCode),
                ),
            );

            const appNameCondition = searchTerms(sql`json_extract(${apps.data}, '$.name')`, this.searchTerm);
            const displayNameCondition = searchTerms(achievementsMeta.display_name, this.searchTerm);
            const descriptionCondition = searchTerms(achievementsMeta.description, this.searchTerm);
            whereConditions.push(or(displayNameCondition, descriptionCondition, appNameCondition));
        }

        // Apply friends filter using JOIN (avoids parameter explosion)
        if (this.friendsOfUserId) {
            query = query.innerJoin(
                friends,
                and(eq(friends.friend_id, userAchievements.user_id), eq(friends.user_id, this.friendsOfUserId)),
            );
        }

        // Apply all WHERE conditions
        query = query.where(and(...whereConditions));

        // Apply sorting
        if (options.sort) {
            const sortDirection = options.sort.direction === "desc" ? desc : asc;
            switch (options.sort.method) {
                case "rarity_pct":
                    query = query.orderBy(sortDirection(achievementsStats.percent));
                    break;
                case "rarity_score":
                    query = query.orderBy(
                        sortDirection(sql`${achievementsStats.percent} * ${estimatedPlayers.estimated_players}`),
                    );
                    break;
                case "unlocked_at":
                    query = query.orderBy(sortDirection(userAchievements.unlocked_at));
                    break;
            }
        }

        // Apply pagination
        if (options.limit) {
            query = query.limit(options.limit);
        }

        if (options.cursor) {
            query = query.offset(options.cursor);
        }

        const userAchievementRows = await query;

        // Step 3: Build final results
        const buildResult = await this.buildResultsFromRows(userAchievementRows, timingId);
        console.timeEnd(`${timingId} UserAchievementQueryComposer.executeDirectQuery`);
        return buildResult;
    }

    /**
     * Execute using pure SQL composition (for complex cases with unlocked filtering)
     * Uses a single comprehensive SQL query with JOINs instead of parameter explosion
     */
    private async executeWithComprehensiveSQL(
        options: ComposableQueryOptions<UserAchievementSortMethod>,
        timingId: string,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        console.time(`${timingId} UserAchievementQueryComposer.executeWithComprehensiveSQL`);
        console.log("🔍 Using pure SQL composition for complex filtering");

        try {
            // Step 1: Determine actual user filtering approach
            const userFilterConditions: SQL[] = [];

            if (this.friendsOfUserId) {
                // Use JOIN with friends table instead of fetching friend IDs (avoids parameter explosion)
                // This will be handled in the main query JOIN, no separate userIds needed
                // But we still need to ensure the target user exists
                await this.ensureUserDataExists();
            } else if (this.userIds.size > 0) {
                // Direct user IDs are safe as they're top-level parameters
                const userIdsArray = Array.from(this.userIds);
                await this.ensureUserDataExists();
                userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
            } else {
                console.log("⚠️ No user filtering criteria provided");
                return Attempt.ok([]);
            }

            // Step 2: Build comprehensive SQL query with all JOINs
            const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

            let query = this.db
                .select({
                    user_id: userAchievements.user_id,
                    app_id: userAchievements.app_id,
                    ach_id: userAchievements.ach_id,
                    unlocked_at: userAchievements.unlocked_at,
                    rarity_pct: achievementsStats.percent,
                    // Achievement metadata from achievements_meta
                    display_name: achievementsMeta.display_name,
                    description: achievementsMeta.description,
                    default_value: achievementsMeta.default_value,
                    hidden: achievementsMeta.hidden,
                    icon: achievementsMeta.icon,
                    icon_gray: achievementsMeta.icon_gray,
                    // App data (JSON field)
                    app_data: apps.data,
                    app_lang: apps.lang,
                    estimated_players: estimatedPlayers.estimated_players,
                })
                .from(userAchievements)
                // JOIN to ensure user owns the game (handles "all owned games" case)
                .innerJoin(
                    ownedGames,
                    and(
                        eq(userAchievements.user_id, ownedGames.user_id),
                        eq(userAchievements.app_id, ownedGames.app_id),
                    ),
                )
                // JOIN for achievement metadata (replaces separate AppAchievement fetch)
                .innerJoin(
                    achievementsMeta,
                    and(
                        eq(userAchievements.app_id, achievementsMeta.app_id),
                        eq(userAchievements.ach_id, achievementsMeta.ach_id),
                        eq(achievementsMeta.lang, apiCode),
                    ),
                )
                // JOIN for app data
                .innerJoin(apps, and(eq(userAchievements.app_id, apps.id), eq(apps.lang, apiCode)))
                // LEFT JOIN for rarity data
                .leftJoin(
                    achievementsStats,
                    and(
                        eq(userAchievements.app_id, achievementsStats.app_id),
                        eq(userAchievements.ach_id, achievementsStats.ach_id),
                    ),
                )
                // LEFT JOIN for estimated players (for rarity score calculation)
                .leftJoin(estimatedPlayers, eq(userAchievements.app_id, estimatedPlayers.app_id))
                .$dynamic();

            // Build WHERE conditions (only safe, top-level parameters)
            const whereConditions: Array<SQL | undefined> = [...userFilterConditions];

            // Apply specific app filter ONLY if provided (avoids empty array issue)
            if (this.appIds.size > 0) {
                whereConditions.push(inArray(userAchievements.app_id, Array.from(this.appIds)));
            }
            // If this.appIds is empty, we get ALL owned games via the ownedGames JOIN ✅

            // Apply specific achievement filter ONLY if provided
            if (this.achievementIds.size > 0) {
                whereConditions.push(inArray(userAchievements.ach_id, Array.from(this.achievementIds)));
            }

            // Apply unlocked filter
            if (this.unlockedFilter !== undefined) {
                whereConditions.push(
                    this.unlockedFilter
                        ? isNotNull(userAchievements.unlocked_at)
                        : isNull(userAchievements.unlocked_at),
                );
            }

            // Apply search filter using already joined achievements_meta
            if (this.searchTerm) {
                const appNameCondition = searchTerms(sql`json_extract(${apps.data}, '$.name')`, this.searchTerm);
                const displayNameCondition = searchTerms(achievementsMeta.display_name, this.searchTerm);
                const descriptionCondition = searchTerms(achievementsMeta.description, this.searchTerm);
                whereConditions.push(or(displayNameCondition, descriptionCondition, appNameCondition));
            }

            // Apply friends filter using JOIN (if not already applied)
            if (this.friendsOfUserId) {
                query = query.innerJoin(
                    friends,
                    and(eq(friends.friend_id, userAchievements.user_id), eq(friends.user_id, this.friendsOfUserId)),
                );
            }

            // Apply all WHERE conditions
            query = query.where(and(...whereConditions));

            // Apply sorting
            if (options.sort) {
                const sortDirection = options.sort.direction === "desc" ? desc : asc;
                switch (options.sort.method) {
                    case "rarity_pct":
                        query = query.orderBy(sortDirection(achievementsStats.percent));
                        break;
                    case "rarity_score":
                        query = query.orderBy(
                            sortDirection(sql`${achievementsStats.percent} * ${estimatedPlayers.estimated_players}`),
                        );
                        break;
                    case "unlocked_at":
                        query = query.orderBy(sortDirection(userAchievements.unlocked_at));
                        break;
                }
            }

            // Apply pagination
            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.cursor) {
                query = query.offset(options.cursor);
            }

            console.log("🚀 Executing comprehensive SQL query with all JOINs");
            const rows = await query;

            // Step 3: Build results directly from comprehensive query results
            return await this.buildResultsFromComprehensiveRows(rows, timingId);
        } finally {
            console.timeEnd(`${timingId} UserAchievementQueryComposer.executeWithComprehensiveSQL`);
        }
    }

    /**
     * Build final SteamUserAchievement objects from comprehensive query rows
     * This handles rows that already include all achievement metadata from JOINs
     */
    private async buildResultsFromComprehensiveRows(
        rows: Array<{
            user_id: string;
            app_id: number;
            ach_id: string;
            unlocked_at: Date | null;
            rarity_pct: number | null;
            display_name: string;
            description: string | null;
            default_value: number;
            hidden: number;
            icon: string;
            icon_gray: string;
            app_data: SteamAppRaw | null; // SteamAppRaw data
            app_lang: APILanguageCode; // APILanguageCode
            estimated_players: number | null;
        }>,
        timingId: string,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        console.time(`${timingId} UserAchievementQueryComposer.buildResultsFromComprehensiveRows`);

        if (rows.length === 0) {
            console.timeEnd(`${timingId} UserAchievementQueryComposer.buildResultsFromComprehensiveRows`);
            return Attempt.ok([]);
        }

        // Extract unique user IDs to fetch user data
        const uniqueUserIds = [...new Set(rows.map((row) => row.user_id))];

        // Fetch user data (we still need this as it's not in the main query) - now returns Attempt
        const userDataResult = await this.userRepository.compose().withUserIds(uniqueUserIds).build();

        // Even if user data fetch fails, we can try to build what we can
        // (though results will be empty without user data)
        const userMap = userDataResult.hasData() ? new Map(userDataResult.data.map((u) => [u.id, u])) : new Map(); // Build results directly from comprehensive rows
        const results: SteamUserAchievement[] = [];

        for (const row of rows) {
            const user = userMap.get(row.user_id);

            if (user && row.app_data && row.display_name) {
                // Create SteamApp object from database data
                const app = new SteamApp({
                    data: row.app_data,
                    estimatedPlayers: row.estimated_players,
                    lang: row.app_lang,
                });

                // Create achievement metadata in the format expected by SteamUserAchievement
                const meta = {
                    name: row.ach_id,
                    defaultvalue: row.default_value,
                    displayName: row.display_name,
                    hidden: row.hidden,
                    description: row.description || "",
                    icon: row.icon,
                    icongray: row.icon_gray,
                };

                // Create global stats (handle null case)
                const globalStats =
                    row.rarity_pct !== null
                        ? {
                              name: row.ach_id,
                              percent: row.rarity_pct,
                          }
                        : {
                              name: row.ach_id,
                              percent: 0, // Default value when no stats available
                          };

                results.push(
                    new SteamUserAchievement({
                        app: app,
                        meta: meta,
                        globalStats: globalStats,
                        lang: row.app_lang,
                        user: user,
                        userStats: row.unlocked_at
                            ? {
                                  apiname: row.ach_id,
                                  achieved: 1,
                                  unlocktime: Math.floor(row.unlocked_at.getTime() / 1000),
                              }
                            : null,
                    }),
                );
            }
        }

        console.timeEnd(`${timingId} UserAchievementQueryComposer.buildResultsFromComprehensiveRows`);
        console.log(`✅ Built ${results.length} final user achievements from comprehensive query`);

        // Return success or partial based on whether we had any errors during user data fetching
        return Attempt.fromSimple(results, userDataResult.error);
    }

    /**
     * Ensure user data exists in the database
     */
    private async ensureUserDataExists(): Promise<Attempt<void, AttemptStatus>> {
        // Determine userIds and appIds from instance properties
        let userIds: string[] = [];
        if (this.friendsOfUserId) {
            userIds = [this.friendsOfUserId];
        } else {
            userIds = Array.from(this.userIds);
        }
        if (userIds.length === 0) return Attempt.ok(undefined);

        // First, ensure user profile and owned games data exists
        const result = await upsertUsers(this.db, this.steamApi, userIds);

        // Then, ensure user achievement data exists for their owned games
        const achievementResult = await this.ensureUserAchievementDataExists();

        // Combine the results - if either has an error, propagate it
        return result.and(achievementResult);
    }

    /**
     * Fetch and upsert user achievement data for their owned games
     * This is the missing piece - we need to populate the user_achievements table
     */
    private async ensureUserAchievementDataExists(): Promise<Attempt<void, AttemptStatus>> {
        // Determine which users to fetch owned games for
        const filterUserIds = this.friendsOfUserId ? [this.friendsOfUserId] : Array.from(this.userIds);
        if (filterUserIds.length === 0) return Attempt.ok(undefined);
        const appFilterIds = Array.from(this.appIds);

        const timingId = generateTimingId();
        console.time(`${timingId} ensureUserAchievementDataExists`);
        console.log(`🔄 Ensuring achievement data exists for ${filterUserIds.length} users`);

        // Get all owned games for these users (database operation - let it throw)
        let ownedGamesQuery = this.db
            .selectDistinct({
                user_id: ownedGames.user_id,
                app_id: ownedGames.app_id,
            })
            .from(ownedGames)
            .where(inArray(ownedGames.user_id, filterUserIds))
            .$dynamic();

        if (appFilterIds.length > 0) {
            ownedGamesQuery = ownedGamesQuery.where(inArray(ownedGames.app_id, appFilterIds));
        }

        const ownedGamesResult = await ownedGamesQuery;

        if (ownedGamesResult.length === 0) {
            console.log("⚠️ No owned games found for users");
            console.timeEnd(`${timingId} ensureUserAchievementDataExists`);
            return Attempt.ok(undefined);
        }

        // Debug: log the number of users, games, and user-game pairs
        const uniqueUsers = new Set(ownedGamesResult.map((row) => row.user_id));
        const uniqueGames = new Set(ownedGamesResult.map((row) => row.app_id));
        // Build optional filter suffix
        const filterSuffix = appFilterIds.length > 0 ? ` (filtered by appIds: ${appFilterIds.join(",")})` : "";
        console.log(
            "🔎 Debug:",
            `${ownedGamesResult.length} user-game pairs,`,
            `${uniqueUsers.size} unique users,`,
            `${uniqueGames.size} unique games${filterSuffix}`,
        );
        console.log(`📊 Found ${ownedGamesResult.length} user-game combinations to check`);

        // Determine missing user+app pairs via pure SQL join diff (database operation - let it throw)
        const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";
        // Build a single where clause combining filters and missing check
        const whereConditions: SQL[] = [inArray(ownedGames.user_id, filterUserIds)];
        if (appFilterIds.length > 0) {
            whereConditions.push(inArray(ownedGames.app_id, appFilterIds));
        }
        whereConditions.push(isNull(userAchievements.ach_id));
        const missingData = await this.db
            .selectDistinct({ user_id: ownedGames.user_id, app_id: ownedGames.app_id })
            .from(ownedGames)
            .innerJoin(
                achievementsMeta,
                and(eq(achievementsMeta.app_id, ownedGames.app_id), eq(achievementsMeta.lang, apiCode)),
            )
            .leftJoin(
                userAchievements,
                and(
                    eq(userAchievements.user_id, ownedGames.user_id),
                    eq(userAchievements.app_id, ownedGames.app_id),
                    eq(userAchievements.ach_id, achievementsMeta.ach_id),
                ),
            )
            .where(and(...whereConditions))
            .$dynamic();

        if (missingData.length === 0) {
            console.log("✅ All user achievement data already exists");
            console.timeEnd(`${timingId} ensureUserAchievementDataExists`);
            return Attempt.ok(undefined);
        }

        console.log(`🚀 Need to fetch achievement data for ${missingData.length} user-game combinations`);

        // Fetch achievement data in batches to avoid API limits
        const BATCH_SIZE = 10; // Conservative limit for Steam API achievement calls
        const achievementDataToInsert: Array<{
            user_id: string;
            app_id: number;
            ach_id: string;
            unlocked_at: Date | null;
        }> = [];

        let accumulatedError: Error | null = null;

        for (let i = 0; i < missingData.length; i += BATCH_SIZE) {
            const batch = missingData.slice(i, i + BATCH_SIZE);
            console.log(
                `📥 Fetching achievement batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(missingData.length / BATCH_SIZE)}`,
            );

            // Use Attempt.all to handle parallel API calls with proper error aggregation
            const batchAttempts = batch.map(async (row) => {
                const { user_id, app_id } = row;
                return Attempt.try(async () => {
                    const achievements = await this.steamApi.getPlayerAchievements({
                        steamid: user_id,
                        appid: app_id,
                    });

                    const achievementList: Array<{
                        user_id: string;
                        app_id: number;
                        ach_id: string;
                        unlocked_at: Date | null;
                    }> = [];

                    if (achievements?.playerstats?.achievements) {
                        for (const ach of achievements.playerstats.achievements) {
                            achievementList.push({
                                user_id,
                                app_id: Number(app_id),
                                ach_id: ach.apiname,
                                unlocked_at:
                                    ach.achieved && ach.unlocktime > 0 ? new Date(ach.unlocktime * 1000) : null,
                            });
                        }
                    }

                    return achievementList;
                });
            });

            const batchResult = await Attempt.all(batchAttempts);

            // Collect data from successful attempts
            if (batchResult.hasData()) {
                // batchResult.data is an array of Attempt objects (from Attempt.try())
                // We need to extract the data from each successful Attempt
                for (const attemptResult of batchResult.data) {
                    if (attemptResult.hasData()) {
                        achievementDataToInsert.push(...attemptResult.data);
                    }
                }
            }

            // Accumulate the first error we encounter
            if (batchResult.error && !accumulatedError) {
                accumulatedError = batchResult.error;
            }
        }

        if (achievementDataToInsert.length > 0) {
            console.log(`💾 Inserting ${achievementDataToInsert.length} achievement records`);

            // Insert achievement data in chunks to avoid SQL parameter limits (database operation - let it throw)
            await safeInsert(this.db, achievementDataToInsert, (batch) =>
                this.db
                    .insert(userAchievements)
                    .values(
                        batch.map((data) => ({
                            user_id: data.user_id,
                            app_id: data.app_id,
                            ach_id: data.ach_id,
                            unlocked_at: data.unlocked_at,
                            updated_at: new Date(),
                        })),
                    )
                    .onConflictDoUpdate({
                        target: [userAchievements.user_id, userAchievements.app_id, userAchievements.ach_id],
                        set: {
                            unlocked_at: userAchievements.unlocked_at,
                            updated_at: new Date(),
                        },
                    }),
            );
            console.log("✅ Successfully inserted/updated achievement data");
        }

        console.timeEnd(`${timingId} ensureUserAchievementDataExists`);

        // Return appropriate result based on whether we encountered errors
        return Attempt.fromSimple(undefined, accumulatedError);
    } /**
     * Build final SteamUserAchievement objects from database rows
     */
    private async buildResultsFromRows(
        userAchievementRows: Array<{
            user_id: string;
            app_id: number;
            ach_id: string;
            unlocked_at: Date | null;
            rarity_pct: number | null;
        }>,
        timingId: string,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        console.time(`${timingId} UserAchievementQueryComposer.buildResultsFromRows`);

        if (userAchievementRows.length === 0) {
            console.timeEnd(`${timingId} UserAchievementQueryComposer.buildResultsFromRows`);
            return Attempt.ok([]);
        }

        // Extract unique identifiers
        const uniqueAppIds = [...new Set(userAchievementRows.map((row) => row.app_id))];
        const uniqueUserIds = [...new Set(userAchievementRows.map((row) => row.user_id))];

        // Fetch metadata using composable repositories - both now return Attempt
        const [appAchievementsResult, userDataResult] = await Promise.all([
            this.appAchievementRepository.compose().withLanguage(this.lang).withAppIds(uniqueAppIds).build(),
            this.userRepository.compose().withUserIds(uniqueUserIds).build(),
        ]);

        // Combine both attempts - if either failed, we can still try to build partial results
        const combinedResult = appAchievementsResult.and(userDataResult);

        // Extract the data from the successful attempts (or empty arrays if failed)
        const appAchievements = appAchievementsResult.hasData() ? appAchievementsResult.data : [];
        const userData = userDataResult.hasData() ? userDataResult.data : [];

        // Create lookup maps
        const appAchievementMap = new Map(appAchievements.map((a) => [`${a.app.id}-${a.id}`, a]));
        const userMap = new Map(userData.map((u) => [u.id, u]));

        // Combine data
        const results: SteamUserAchievement[] = [];

        for (const row of userAchievementRows) {
            const user = userMap.get(row.user_id);
            if (!user) continue;
            if (user.private) continue; // Skip private users

            const appAchievement = appAchievementMap.get(`${row.app_id}-${row.ach_id}`);

            if (user && appAchievement) {
                results.push(
                    new SteamUserAchievement({
                        app: appAchievement.app,
                        meta: appAchievement.serialize().meta,
                        globalStats: appAchievement.serialize().globalStats,
                        lang: appAchievement.serialize().lang,
                        user: user,
                        userStats: row.unlocked_at
                            ? {
                                  apiname: row.ach_id,
                                  achieved: 1,
                                  unlocktime: Math.floor(row.unlocked_at.getTime() / 1000),
                              }
                            : null,
                    }),
                );
            }
        }

        console.timeEnd(`${timingId} UserAchievementQueryComposer.buildResultsFromRows`);
        console.log(`✅ Built ${results.length} final user achievements`);

        // Return success or partial based on whether we had any errors during dependency fetching
        return Attempt.fromSimple(results, combinedResult.error);
    }
}

export class UserAchievementRepository
    implements
        Repository<SteamUserAchievement, UserAchievementFilters, UserAchievementSortMethod>,
        ComposableRepository<SteamUserAchievement, UserAchievementSortMethod, UserAchievementQueryComposer>
{
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private sqlite: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
        private appAchievementRepository: AppAchievementRepository,
        private userRepository: UserRepository,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): UserAchievementQueryComposer {
        return new UserAchievementQueryComposer(
            this.sqlite,
            this.steamApi,
            this.appAchievementRepository,
            this.userRepository,
        );
    }
}

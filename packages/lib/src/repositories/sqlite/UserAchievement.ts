import { type SQL, and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
    type ProjectDB,
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
import { SteamApp, type SteamAppAchievement, type SteamFriendUser, SteamUserAchievement } from "../../models";
import type { SteamAppRaw } from "../../models/SteamApp";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import {
    type ComposableQueryOptions,
    ComposableQueryResult,
    type ComposableRepository,
    type SubqueryProvider,
    createQueryResult,
} from "../composable";
import type { Repository, RepositoryParams, RepositorySort } from "../repository";
import type { AppRepository } from "./App";
import type { AppAchievementRepository } from "./AppAchievement";
import { BaseAchievementQueryComposer } from "./BaseAchievement";
import type { FriendsRepository } from "./Friends";
import type { UserRepository } from "./User";
import { achievementsMeta } from "./schema";
import { safeInsert } from "./utils";

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
 * ## How Parameter Explosion is Avoided:
 *
 * ### Before (Problematic):
 * ```typescript
 * const achievements = await query.where(inArray(apps.id, ownedGameIds)); // 💥 FAILS
 * const friendAchievements = await query.where(inArray(userAchievements.user_id, friendIds)); // 💥 FAILS
 * ```
 *
 * ### After (Fixed):
 * ```typescript
 * const achievements = await db
 *   .select()
 *   .from(userAchievements)
 *   .innerJoin(ownedGames, eq(userAchievements.app_id, ownedGames.app_id)) // All owned games
 *   .innerJoin(friends, eq(friends.friend_id, userAchievements.user_id))   // All friends
 *   .where(eq(friends.user_id, userId)); // ✅ WORKS
 * ```
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
class UserAchievementQueryComposer
    extends BaseAchievementQueryComposer<SteamUserAchievement, UserAchievementSortMethod>
    implements SubqueryProvider
{
    private userIds: Set<string> = new Set();
    private friendsOfUserId?: string;
    private unlockedFilter?: boolean;

    constructor(
        db: ProjectDB,
        private steamApi: SteamAuthenticatedAPIClient,
        private appAchievementRepository: AppAchievementRepository,
        private userRepository: UserRepository,
        private friendsRepository: FriendsRepository,
        private appRepository: AppRepository,
    ) {
        super(db);
    }

    /**
     * Create inArray condition for app IDs using userAchievements table
     */
    protected createAppIdsCondition(appIds: number[]): SQL {
        return inArray(userAchievements.app_id, appIds);
    }

    /**
     * Create inArray condition for achievement IDs using userAchievements table
     */
    protected createAchievementIdsCondition(achIds: string[]): SQL {
        return inArray(userAchievements.ach_id, achIds);
    }

    /**
     * Apply sorting to a query based on the sort options
     * Handles UserAchievement-specific sorting patterns (rarity_pct, rarity_score, unlocked_at)
     */
    // biome-ignore lint/suspicious/noExplicitAny: Generic query type from Drizzle
    private applySorting(query: any, options: ComposableQueryOptions<UserAchievementSortMethod>): any {
        if (!options.sort) return query;

        switch (options.sort.method) {
            case "rarity_pct": {
                const dir = options.sort.direction === "desc" ? desc : asc;
                return query.orderBy(dir(achievementsStats.percent));
            }
            case "rarity_score": {
                const dir = options.sort.direction === "desc" ? desc : asc;
                const score = sql`${achievementsStats.percent} * ${estimatedPlayers.estimated_players}`;
                // Always push NULLs to the end regardless of sort direction
                return query.orderBy(
                    asc(
                        sql`CASE WHEN ${achievementsStats.percent} IS NULL OR ${estimatedPlayers.estimated_players} IS NULL THEN 1 ELSE 0 END`,
                    ),
                    dir(score),
                );
            }
            case "unlocked_at": {
                const dir = options.sort.direction === "desc" ? desc : asc;
                // Always push NULLs to the end regardless of sort direction
                return query.orderBy(
                    asc(sql`CASE WHEN ${userAchievements.unlocked_at} IS NULL THEN 1 ELSE 0 END`),
                    dir(userAchievements.unlocked_at),
                );
            }
            default:
                return query;
        }
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
        // Add WHERE condition for unlocked status
        if (unlocked !== undefined) {
            this.whereConditions.push(
                unlocked ? isNotNull(userAchievements.unlocked_at) : isNull(userAchievements.unlocked_at),
            );
        }
        return this;
    }

    /**
     * Build a subquery that selects the app IDs required by this query
     * This enables cross-repository data dependency resolution without parameter explosion
     */
    buildRequiredEntitySubquery(entityType: string): SQL | undefined {
        if (entityType !== "apps") {
            return undefined;
        }

        // Build the same logic we use to determine which apps we need
        let neededAppsQuery = this.db.selectDistinct({ app_id: ownedGames.app_id }).from(ownedGames).$dynamic();

        // Apply the same user filtering logic as our main query
        if (this.friendsOfUserId) {
            neededAppsQuery = neededAppsQuery
                .innerJoin(friends, eq(friends.friend_id, ownedGames.user_id))
                .where(eq(friends.user_id, this.friendsOfUserId));
        } else if (this.userIds.size > 0) {
            neededAppsQuery = neededAppsQuery.where(inArray(ownedGames.user_id, Array.from(this.userIds)));
        } else {
            // No user filter specified - can't determine needed apps
            return undefined;
        }

        // If we have explicit app IDs, intersect with those
        if (this.appIds.size > 0) {
            neededAppsQuery = neededAppsQuery.where(inArray(ownedGames.app_id, Array.from(this.appIds)));
        }

        return neededAppsQuery.getSQL();
    }

    /**
     * Build and execute the composed query
     */
    async build(
        options: ComposableQueryOptions<UserAchievementSortMethod> = {},
    ): Promise<ComposableQueryResult<SteamUserAchievement>> {
        // Check if we have any user filtering criteria
        if (this.userIds.size === 0 && !this.friendsOfUserId) {
            return createQueryResult([], options.cursor || 0);
        }

        // Determine processing mode based on filters
        const shouldUseComprehensiveSQL = this.shouldUseComprehensiveSQL();

        const resultsAttempt = await (shouldUseComprehensiveSQL
            ? this.executeWithComprehensiveSQL(options)
            : this.executeDirectQuery(options));

        // If we got no results but the caller requested a specific app (e.g. viewing a single game page),
        // fall back to returning the global AppAchievement list for that app with userStats=null so logged-in
        // non-owners still see the app's achievements (mirrors anonymous behavior).
        if (resultsAttempt.hasData() && resultsAttempt.data.length === 0 && this.appIds.size > 0) {
            try {
                const appIds = Array.from(this.appIds);
                // Fetch app achievements
                const appAchResult = await this.appAchievementRepository
                    .compose()
                    .withLanguage(this.lang)
                    .withAppIds(appIds)
                    .build();

                const finalData: SteamUserAchievement[] = [];
                if (appAchResult.hasData()) {
                    // Determine a primary user to attach (if available). Prefer explicit userIds, otherwise use friendsOfUserId.
                    let primaryUserId: string | undefined;
                    if (this.userIds.size > 0) primaryUserId = Array.from(this.userIds)[0];
                    else if (this.friendsOfUserId) primaryUserId = this.friendsOfUserId;

                    // Fetch user object if we have an ID to attach
                    let userObj = null;
                    if (primaryUserId) {
                        const userRes = await this.userRepository.compose().withUserIds([primaryUserId]).build();
                        if (userRes.hasData() && userRes.data.length > 0) {
                            userObj = userRes.data[0];
                        }
                    }

                    for (const appAch of appAchResult.data) {
                        // Build a SteamUserAchievement with userStats=null (user hasn't unlocked anything)
                        finalData.push(
                            new SteamUserAchievement({
                                app: appAch.app,
                                meta: appAch.serialize().meta,
                                globalStats: appAch.serialize().globalStats,
                                lang: appAch.serialize().lang,
                                user: userObj ?? undefined,
                                userStats: null,
                            }),
                        );
                    }
                }

                const combinedError = resultsAttempt.error || (appAchResult?.error ?? null);
                return new ComposableQueryResult(finalData, (options.cursor || 0) + finalData.length, combinedError);
            } catch (fallbackError) {
                // If fallback fails, just fall back to the original (empty) result with the original error
                console.warn("UserAchievement fallback to AppAchievement failed:", fallbackError);
                return new ComposableQueryResult(
                    resultsAttempt.hasData() ? resultsAttempt.data : [],
                    (options.cursor || 0) + (resultsAttempt.hasData() ? resultsAttempt.data.length : 0),
                    resultsAttempt.error,
                );
            }
        }

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
     * 4. Filtering by rarity threshold (needs rarity data)
     */
    private shouldUseComprehensiveSQL(): boolean {
        return (
            this.unlockedFilter !== undefined ||
            this.searchTerm !== undefined ||
            this.appIds.size === 0 ||
            this.rarityThreshold !== undefined
        );
    }

    /**
     * Execute using direct SQL query (for simple cases)
     */
    private async executeDirectQuery(
        options: ComposableQueryOptions<UserAchievementSortMethod>,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        console.log("🚀 Using direct query processing");

        // Step 1: Determine actual user filtering approach
        const userFilterConditions: SQL[] = [];

        let ensureResult: Attempt<void, AttemptStatus>;
        if (this.friendsOfUserId) {
            // Use JOIN with friends table instead of fetching friend IDs (avoids parameter explosion)
            // But we still need to ensure the friends' data exists in the database
            ensureResult = await this.ensureUserDataExists();
            // The actual user filtering will be handled in the main query JOIN below
        } else if (this.userIds.size > 0) {
            // Direct user IDs are safe as they're top-level parameters
            ensureResult = await this.ensureUserDataExists();
            const userIdsArray = this.userIds.values().toArray();
            userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
        } else {
            console.log("⚠️ No user filtering criteria provided");
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

        // Add CTEs if any exist
        if (this.ctes.length > 0) {
            query = this.db
                .with(...this.ctes)
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
                    and(
                        eq(userAchievements.user_id, ownedGames.user_id),
                        eq(userAchievements.app_id, ownedGames.app_id),
                    ),
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
        }

        // Apply user filter (safe - these are top-level parameters)
        const whereConditions: Array<SQL | undefined> = [...userFilterConditions];

        // Note: Search filter is now handled via CTE in BaseAchievementQueryComposer
        // No need for manual JOINs here anymore

        // Add all pre-built WHERE conditions (app IDs, achievement IDs, unlocked status, rarity)
        whereConditions.push(...this.buildStandardWhereConditions());

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
        query = this.applySorting(query, options);

        // Apply pagination
        if (options.limit) {
            query = query.limit(options.limit);
        }

        if (options.cursor) {
            query = query.offset(options.cursor);
        }

        const userAchievementRows = await query;

        // Step 3: Build final results
        const buildResult = await this.buildResultsFromRows(userAchievementRows);
        return ensureResult.and(buildResult);
    }

    /**
     * Execute using pure SQL composition (for complex cases with unlocked filtering)
     * Uses a single comprehensive SQL query with JOINs instead of parameter explosion
     */
    private async executeWithComprehensiveSQL(
        options: ComposableQueryOptions<UserAchievementSortMethod>,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        console.log("🔍 Using pure SQL composition for complex filtering");

        // Step 1: Determine actual user filtering approach
        const userFilterConditions: SQL[] = [];

        let ensureResult: Attempt<void, AttemptStatus>;
        if (this.friendsOfUserId) {
            // Use JOIN with friends table instead of fetching friend IDs (avoids parameter explosion)
            // This will be handled in the main query JOIN, no separate userIds needed
            // But we still need to ensure the target user exists
            ensureResult = await this.ensureUserDataExists();
        } else if (this.userIds.size > 0) {
            // Direct user IDs are safe as they're top-level parameters
            const userIdsArray = Array.from(this.userIds);
            ensureResult = await this.ensureUserDataExists();
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
                // Also select the actual language used (for fallback detection)
                achievement_lang: achievementsMeta.lang,
                // App data (JSON field)
                app_data: apps.data,
                app_lang: apps.lang,
                estimated_players: estimatedPlayers.estimated_players,
            })
            .from(userAchievements)
            // JOIN to ensure user owns the game (handles "all owned games" case)
            .innerJoin(
                ownedGames,
                and(eq(userAchievements.user_id, ownedGames.user_id), eq(userAchievements.app_id, ownedGames.app_id)),
            )
            // JOIN for achievement metadata with fallback logic (requested language -> English)
            .innerJoin(
                achievementsMeta,
                and(
                    eq(userAchievements.app_id, achievementsMeta.app_id),
                    eq(userAchievements.ach_id, achievementsMeta.ach_id),
                    // Fallback logic: try requested language first, then English
                    sql`${achievementsMeta.lang} = (
                            SELECT COALESCE(
                                (SELECT lang FROM ${achievementsMeta} WHERE app_id = ${userAchievements.app_id} AND ach_id = ${userAchievements.ach_id} AND lang = ${apiCode} LIMIT 1),
                                (SELECT lang FROM ${achievementsMeta} WHERE app_id = ${userAchievements.app_id} AND ach_id = ${userAchievements.ach_id} AND lang = 'english' LIMIT 1)
                            )
                        )`,
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

        // Add CTEs if any exist
        if (this.ctes.length > 0) {
            query = this.db
                .with(...this.ctes)
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
                    // Also select the actual language used (for fallback detection)
                    achievement_lang: achievementsMeta.lang,
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
                // JOIN for achievement metadata with fallback logic (requested language -> English)
                .innerJoin(
                    achievementsMeta,
                    and(
                        eq(userAchievements.app_id, achievementsMeta.app_id),
                        eq(userAchievements.ach_id, achievementsMeta.ach_id),
                        // Fallback logic: try requested language first, then English
                        sql`${achievementsMeta.lang} = (
                                SELECT COALESCE(
                                    (SELECT lang FROM ${achievementsMeta} WHERE app_id = ${userAchievements.app_id} AND ach_id = ${userAchievements.ach_id} AND lang = ${apiCode} LIMIT 1),
                                    (SELECT lang FROM ${achievementsMeta} WHERE app_id = ${userAchievements.app_id} AND ach_id = ${userAchievements.ach_id} AND lang = 'english' LIMIT 1)
                                )
                            )`,
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
        }

        // Build WHERE conditions (only safe, top-level parameters)
        const whereConditions: Array<SQL | undefined> = [...userFilterConditions];

        // Add all pre-built WHERE conditions (app IDs, achievement IDs, unlocked status, rarity, search)
        whereConditions.push(...this.buildStandardWhereConditions());

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
        query = this.applySorting(query, options);

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
        return this.buildResultsFromComprehensiveRows(rows);
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
            achievement_lang: APILanguageCode; // Language actually used for achievement metadata
            app_data: SteamAppRaw | null; // SteamAppRaw data
            app_lang: APILanguageCode; // APILanguageCode
            estimated_players: number | null;
        }>,
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        if (rows.length === 0) {
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

                // Determine effective language: use achievement_lang if available, otherwise app_lang
                const effectiveLanguage = row.achievement_lang || row.app_lang;

                results.push(
                    new SteamUserAchievement({
                        app: app,
                        meta: meta,
                        globalStats: globalStats,
                        lang: effectiveLanguage, // Use the actual achievement language
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

        console.log(`✅ Built ${results.length} final user achievements from comprehensive query`);

        // Return success or partial based on whether we had any errors during user data fetching
        return Attempt.from(results, userDataResult.error);
    }

    /**
     * Ensure user data exists in the database
     *
     * Note: For friends mode, we need to resolve the actual friend user IDs first
     * because user data fetching requires the actual user IDs to fetch profile/owned games data.
     * The query execution part uses JOINs to avoid parameter explosion.
     */
    private async ensureUserDataExists(): Promise<Attempt<void, AttemptStatus>> {
        // For user data, we need to determine the actual users to upsert
        let friendsResult: ComposableQueryResult<SteamFriendUser> | null = null;
        let result: Attempt<void, AttemptStatus>;

        if (this.friendsOfUserId) {
            // When friendsOfUserId is set, we first need to ensure the friends data exists
            // This will populate the friends table if it doesn't exist yet
            console.log(`🔍 Ensuring friends data exists for user ${this.friendsOfUserId}`);
            friendsResult = await this.friendsRepository
                .compose()
                .withUserIds(this.friendsOfUserId)
                .build({ limit: 1000 }); // Get up to 1000 friends

            if (friendsResult.error) {
                console.warn(`Failed to fetch friends for user ${this.friendsOfUserId}:`, friendsResult.error);
            }

            // Use subquery to get friend IDs instead of extracting them (avoids parameter explosion)
            console.log(`🔍 Using subquery for friends of user ${this.friendsOfUserId}`);

            // First, ensure user profile and owned games data exists using subquery
            const friendUserIdsSubquery = sql`(
                SELECT DISTINCT friend_id AS user_id
                FROM friends
                WHERE user_id = ${this.friendsOfUserId}
            )`;

            result = await this.userRepository
                .compose()
                .withRequiredEntitySubquery("user", friendUserIdsSubquery)
                .ensureDataExists();
        } else {
            const userIds = Array.from(this.userIds);
            if (userIds.length === 0) return Attempt.ok(undefined);

            // First, ensure user profile and owned games data exists
            result = await this.userRepository.compose().withUserIds(userIds).ensureDataExists();
        }

        // Then, ensure app data exists for the apps we'll be querying
        const appDataResult = await this.ensureAppDataExists();

        // Then, ensure user achievement data exists for their owned games
        const achievementResult = await this.ensureUserAchievementDataExists();

        // Combine all results - if any has an error, propagate it
        let finalResult = result.and(appDataResult).and(achievementResult);

        // Include friends result if it exists
        if (friendsResult) {
            finalResult = finalResult.and(friendsResult.map(() => undefined)); // Convert to void for combination
        }

        return finalResult;
    }

    /**
     * Fetch and upsert user achievement data for their owned games
     * This is the missing piece - we need to populate the user_achievements table
     */
    private async ensureUserAchievementDataExists(): Promise<Attempt<void, AttemptStatus>> {
        // Build base query that will be used for both owned games and missing data queries
        let baseQuery = this.db
            .selectDistinct({
                user_id: ownedGames.user_id,
                app_id: ownedGames.app_id,
            })
            .from(ownedGames)
            .$dynamic();

        // Apply user filtering - use different approaches for friends vs direct user IDs
        if (this.friendsOfUserId) {
            console.log(`🔄 Ensuring achievement data exists for friends of user ${this.friendsOfUserId}`);
            // Use JOIN with friends table to get owned games for friends (avoids parameter explosion)
            baseQuery = baseQuery
                .innerJoin(friends, eq(friends.friend_id, ownedGames.user_id))
                .where(eq(friends.user_id, this.friendsOfUserId));
        } else if (this.userIds.size > 0) {
            const filterUserIds = Array.from(this.userIds);
            console.log(`🔄 Ensuring achievement data exists for ${filterUserIds.length} users`);
            baseQuery = baseQuery.where(inArray(ownedGames.user_id, filterUserIds));
        } else {
            console.log("⚠️ No users specified for achievement data fetching");
            return Attempt.ok(undefined);
        }

        // Apply app filtering if specified
        const appFilterIds = Array.from(this.appIds);
        if (appFilterIds.length > 0) {
            baseQuery = baseQuery.where(inArray(ownedGames.app_id, appFilterIds));
        }

        // Get all owned games for the target users
        const ownedGamesResult = await baseQuery;

        if (ownedGamesResult.length === 0) {
            console.log("⚠️ No owned games found for target users");
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

        // Now find missing user achievement data using the same filtering approach
        const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

        // Build missing data query with the same user filtering logic
        let missingDataQuery = this.db
            .selectDistinct({
                user_id: ownedGames.user_id,
                app_id: ownedGames.app_id,
            })
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
            .$dynamic();

        // Apply the same user filtering as above
        const whereConditions: SQL[] = [isNull(userAchievements.ach_id)];
        if (this.friendsOfUserId) {
            // Use JOIN with friends table for friends filtering
            missingDataQuery = missingDataQuery.innerJoin(friends, eq(friends.friend_id, ownedGames.user_id));
            whereConditions.push(eq(friends.user_id, this.friendsOfUserId));
        } else if (this.userIds.size > 0) {
            const filterUserIds = Array.from(this.userIds);
            whereConditions.push(inArray(ownedGames.user_id, filterUserIds));
        }

        // Apply app filtering if specified
        if (appFilterIds.length > 0) {
            whereConditions.push(inArray(ownedGames.app_id, appFilterIds));
        }

        missingDataQuery = missingDataQuery.where(and(...whereConditions));

        const missingData = await missingDataQuery;

        if (missingData.length === 0) {
            console.log("✅ All user achievement data already exists");
            return Attempt.ok(undefined);
        }

        console.log(`🚀 Need to fetch achievement data for ${missingData.length} user-game combinations`);

        const fetchUserAchievements = async (row: {
            user_id: string;
            app_id: number;
        }) => {
            const { user_id, app_id } = row;
            const achievements = await this.steamApi.getPlayerAchievements({
                steamid: user_id,
                appid: app_id,
            });

            const achievementList = [];

            if (achievements?.playerstats?.achievements) {
                for (const ach of achievements.playerstats.achievements) {
                    achievementList.push({
                        user_id,
                        app_id: Number(app_id),
                        ach_id: ach.apiname,
                        unlocked_at: ach.achieved && ach.unlocktime > 0 ? new Date(ach.unlocktime * 1000) : null,
                    });
                }
            }

            return achievementList;
        };

        // Fetch all user achievements concurrently with partial result support
        const achievementsResult = await Attempt.all(missingData.map((row) => fetchUserAchievements(row)));

        // Collect all achievement data from successful fetches
        const achievementDataToInsert = achievementsResult.data.flat();
        const accumulatedError = achievementsResult.error;

        if (achievementDataToInsert.length > 0) {
            console.log(`💾 Inserting ${achievementDataToInsert.length} achievement records`);

            // Insert achievement data in chunks to avoid SQL parameter limits (database operation - let it throw)
            await safeInsert(
                this.db,
                achievementDataToInsert.filter((d) => d !== undefined),
                (batch) =>
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
                                unlocked_at: sql`excluded.unlocked_at`,
                                updated_at: new Date(),
                            },
                        }),
            );
            console.log("✅ Successfully inserted/updated achievement data");
            // 🔧 Optional minimal instrumentation to verify inserts/updates landed
            try {
                const userIdSet = new Set<string>();
                const appIdSet = new Set<number>();
                for (const d of achievementDataToInsert) {
                    if (!d) continue;
                    userIdSet.add(d.user_id);
                    appIdSet.add(d.app_id);
                }
                const processedUserIds = Array.from(userIdSet);
                const processedAppIds = Array.from(appIdSet);
                if (processedUserIds.length > 0 && processedAppIds.length > 0) {
                    const countResult = await this.db
                        .select({ count: sql<number>`count(*)` })
                        .from(userAchievements)
                        .where(
                            and(
                                inArray(userAchievements.user_id, processedUserIds),
                                inArray(userAchievements.app_id, processedAppIds),
                            ),
                        );
                    const postCount = countResult[0]?.count ?? 0;
                    console.log(`🔧 Post-insert count=${postCount}`);
                }
            } catch {
                // keep instrumentation non-fatal and quiet on errors
            }
        }

        // Return appropriate result based on whether we encountered errors
        return Attempt.from(undefined, accumulatedError);
    }

    /**
     * Ensure app data exists in the database for the apps we'll be querying
     * Uses subquery-based approach to avoid parameter explosion
     */
    private async ensureAppDataExists(): Promise<Attempt<void, AttemptStatus>> {
        // Build subquery for required apps using the same logic as our main query
        const requiredAppsSubquery = this.buildRequiredEntitySubquery("apps");

        if (!requiredAppsSubquery) {
            console.log("⚠️ No app subquery could be built (no users specified?)");
            return Attempt.ok(undefined);
        }

        console.log("🚀 Ensuring app data exists using subquery-based approach");

        // Use the App repository with subquery-based data ensuring
        const appDataResult = await this.appRepository
            .compose()
            .withLanguage(this.lang)
            .withRequiredEntitySubquery("apps", requiredAppsSubquery)
            .build();

        if (appDataResult.error) {
            console.warn("Failed to ensure app data exists:", appDataResult.error);
            return Attempt.partial(undefined, appDataResult.error);
        }

        console.log("✅ App data ensured using subquery approach");
        return Attempt.ok(undefined);
    }

    /**
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
    ): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
        if (userAchievementRows.length === 0) {
            return Attempt.ok([]);
        }

        // Extract unique user IDs (this is typically bounded by pagination/filtering)
        const uniqueUserIds = [...new Set(userAchievementRows.map((row) => row.user_id))];
        const uniqueAppIds = [...new Set(userAchievementRows.map((row) => row.app_id))];

        // Use safe approach for app achievements to avoid parameter explosion
        let appAchievementsResult: Attempt<SteamAppAchievement[]>;

        if (uniqueAppIds.length <= 50) {
            // Safe to use direct approach for small sets
            appAchievementsResult = await this.appAchievementRepository
                .compose()
                .withLanguage(this.lang)
                .withAppIds(uniqueAppIds)
                .build();
        } else {
            // For larger sets, chunk the requests
            // TODO this is still giving me PTSD
            const CHUNK_SIZE = 50;
            const chunks: number[][] = [];
            for (let i = 0; i < uniqueAppIds.length; i += CHUNK_SIZE) {
                chunks.push(uniqueAppIds.slice(i, i + CHUNK_SIZE));
            }

            const chunkResults = await Promise.all(
                chunks.map((chunk) =>
                    this.appAchievementRepository.compose().withLanguage(this.lang).withAppIds(chunk).build(),
                ),
            );

            // Combine results
            const allAppAchievements: SteamAppAchievement[] = [];
            let hasError = false;
            let firstError: Error | null = null;

            for (const result of chunkResults) {
                if (result.hasData()) {
                    allAppAchievements.push(...result.data);
                } else if (!firstError) {
                    hasError = true;
                    firstError = new Error("Failed to fetch app achievements chunk");
                }
            }

            appAchievementsResult = Attempt.from(allAppAchievements, firstError);
        }

        const userDataResult = await this.userRepository.compose().withUserIds(uniqueUserIds).build();

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

        console.log(`✅ Built ${results.length} final user achievements`);

        // Return success or partial based on whether we had any errors during dependency fetching
        return Attempt.from(results, combinedResult.error);
    }
}

export class UserAchievementRepository
    implements
        Repository<SteamUserAchievement, UserAchievementFilters, UserAchievementSortMethod>,
        ComposableRepository<SteamUserAchievement, UserAchievementSortMethod, UserAchievementQueryComposer>
{
    constructor(
        private sqlite: ProjectDB,
        private steamApi: SteamAuthenticatedAPIClient,
        private appAchievementRepository: AppAchievementRepository,
        private userRepository: UserRepository,
        private friendsRepository: FriendsRepository,
        private appRepository: AppRepository,
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
            this.friendsRepository,
            this.appRepository,
        );
    }
}

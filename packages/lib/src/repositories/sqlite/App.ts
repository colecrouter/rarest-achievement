import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
    Attempt,
    type AttemptStatus,
    type APILanguageCode,
    type LanguageCode,
    achievementsMeta,
    achievementsStats,
    apps,
    estimatedPlayers,
    getLanguageByCode,
    ownedGames,
} from "../..";
import { estimatePlayerCount } from "../../ml/playerEstimate";
import { SteamApp, type SteamAppRaw } from "../../models";
import { generateTimingId } from "../../utils/timing";
import { SteamChartsAPIClient } from "../api/steamcharts/client";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import { SteamStoreAPIClient } from "../api/store/client";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type QueryComposer,
    createQueryResult,
} from "../composable";
import { type Repository, type RepositoryParams, RepositoryResult } from "../repository";
import { safeInsert, searchTerms } from "./utils";

type AppSortMethod = "id";

export interface AppSortFilters {
    id: number;
}

class AppQueryComposer implements QueryComposer<SteamApp, AppSortMethod> {
    private appIds: Set<number> = new Set();
    private whereConditions: unknown[] = [];
    private ctes: unknown[] = [];
    private lang: LanguageCode = "en";
    private searchTerm?: string; /// TODO

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private db: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
    ) {}

    /**
     * Set the language for this query
     */
    withLanguage(lang: LanguageCode): this {
        this.lang = lang;
        return this;
    }

    /**
     * Filter apps by specific IDs
     */
    withAppIds(appIds: number | Iterable<number>): this {
        if (typeof appIds === "number") {
            this.appIds.add(appIds);
        } else {
            for (const id of appIds) {
                this.appIds.add(id);
            }
        }

        this.whereConditions.push(inArray(apps.id, Array.from(this.appIds)));
        return this;
    }

    /**
     * Filter apps owned by specific users (SQL subquery - no parameter explosion)
     */
    withOwnedByUsers(userIds: string | Iterable<string>): this {
        const ids = typeof userIds === "string" ? [userIds] : Array.from(userIds);
        if (ids.length === 0) return this;

        // Use CTE to get apps owned by specified users
        const ownedAppsCTE = this.db
            .$with("owned_apps")
            .as(
                this.db
                    .selectDistinct({ app_id: ownedGames.app_id })
                    .from(ownedGames)
                    .where(inArray(ownedGames.user_id, ids)),
            );

        this.ctes.push(ownedAppsCTE);
        this.whereConditions.push(inArray(apps.id, this.db.select({ app_id: ownedAppsCTE.app_id }).from(ownedAppsCTE)));

        return this;
    }

    /**
     * Filter apps that have achievements (SQL subquery)
     */
    withAchievements(): this {
        const appsWithAchievementsCTE = this.db
            .$with("apps_with_achievements")
            .as(this.db.selectDistinct({ app_id: achievementsStats.app_id }).from(achievementsStats));

        this.ctes.push(appsWithAchievementsCTE);
        this.whereConditions.push(
            inArray(apps.id, this.db.select({ app_id: appsWithAchievementsCTE.app_id }).from(appsWithAchievementsCTE)),
        );

        return this;
    }

    /**
     * Filter apps by search term (name contains search)
     */
    withSearch(search: string): this {
        this.searchTerm = search;
        const searchCondition = searchTerms(sql`json_extract(${apps.data}, '$.name')`, search);
        this.whereConditions.push(searchCondition);
        return this;
    }

    /**
     * Build and execute the composed query with error propagation
     */
    async build(options: ComposableQueryOptions<AppSortMethod> = {}): Promise<ComposableQueryResult<SteamApp>> {
        const timingId = generateTimingId();
        console.time(`${timingId} AppQueryComposer.build`);

        let accumulatedError: Error | null = null;

        // First ensure all required data exists (this may accumulate errors)
        const ensureDataResult = await this.ensureDataExists();
        if (ensureDataResult.error && !accumulatedError) {
            accumulatedError = ensureDataResult.error;
            console.warn("Failed to ensure all data exists, continuing with existing data:", ensureDataResult.error);
        }

        // Start with base query
        let query = this.db.select({ apps: apps }).from(apps);

        // Add CTEs if any exist
        if (this.ctes.length > 0) {
            query = this.db
                // @ts-expect-error - Drizzle CTE types are complex
                .with(...this.ctes)
                .select({ apps: apps })
                .from(apps);
        }

        // Make query dynamic for where conditions
        const dynamicQuery = query.$dynamic();

        // Add language filter and all other where conditions
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";
        const allConditions = [eq(apps.lang, lang), ...this.whereConditions];

        let finalQuery = dynamicQuery;
        if (allConditions.length > 0) {
            // @ts-expect-error - Drizzle where condition types
            finalQuery = finalQuery.where(and(...allConditions));
        }

        // Apply sorting
        if (options.sort) {
            const sortDir = options.sort.direction === "desc" ? desc : asc;
            const sortMethod = apps.id; // Currently only "id" is supported
            finalQuery = finalQuery.orderBy(sortDir(sortMethod));
        }

        // Apply pagination
        if (options.limit !== undefined) {
            finalQuery = finalQuery.limit(options.limit);
        }
        if (options.cursor !== undefined) {
            finalQuery = finalQuery.offset(options.cursor);
        }

        // Execute the main query
        const appRows = await finalQuery;

        // Get player estimates if required - check all returned app IDs
        let estimatedPlayersRows: Array<{ estimated_players: typeof estimatedPlayers.$inferSelect }> = [];
        if (appRows.length > 0) {
            const returnedAppIds = appRows.map((row) => row.apps.id);
            estimatedPlayersRows = await this.db
                .select({
                    estimated_players: estimatedPlayers,
                })
                .from(estimatedPlayers)
                .where(inArray(estimatedPlayers.app_id, returnedAppIds));
        }

        // Map results to SteamApp objects
        const filteredAppRows = appRows.filter((row) => row.apps.data !== null);
        const items = filteredAppRows.map(({ apps: appRow }) => {
            const playerEstimate =
                estimatedPlayersRows.find((ep) => ep.estimated_players.app_id === appRow.id)?.estimated_players
                    .estimated_players ?? null;

            return new SteamApp({
                data: appRow.data as SteamAppRaw,
                estimatedPlayers: playerEstimate,
                lang: appRow.lang,
            });
        });

        console.timeEnd(`${timingId} AppQueryComposer.build`);

        // Return ComposableQueryResult with error propagation
        return createQueryResult(items, options.cursor, accumulatedError);
    }

    /**
     * Execute the query - alias for build() for backward compatibility
     */
    async execute(options?: ComposableQueryOptions<AppSortMethod>): Promise<ComposableQueryResult<SteamApp>> {
        return this.build(options || {});
    }

    /**
     * Ensure all required data exists in the database
     */
    private async ensureDataExists(): Promise<Attempt<void, AttemptStatus>> {
        if (this.appIds.size === 0) return Attempt.ok(undefined);

        let accumulatedError: Error | null = null;

        // Check for missing apps
        const missingAppIds = await this.findMissingApps(Array.from(this.appIds));
        if (missingAppIds.length > 0) {
            console.log(`📦 Fetching ${missingAppIds.length} missing apps`);
            const appsResult = await this.fetchAndUpsertApps(missingAppIds);
            if (appsResult.error && !accumulatedError) {
                accumulatedError = appsResult.error;
            }
        }

        const missingPlayerIds = await this.findMissingPlayerEstimates(Array.from(this.appIds));
        if (missingPlayerIds.length > 0) {
            console.log(`📊 Fetching ${missingPlayerIds.length} missing player estimates`);
            const playerEstimatesResult = await this.fetchAndUpsertPlayerEstimates(missingPlayerIds);
            if (playerEstimatesResult.error && !accumulatedError) {
                accumulatedError = playerEstimatesResult.error;
            }
        }

        return Attempt.fromSimple(undefined, accumulatedError);
    }

    /**
     * Find apps that are missing from the database
     */
    private async findMissingApps(appIds: number[]): Promise<number[]> {
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";
        const presentIds = new Set(
            (
                await this.db
                    .selectDistinct({ id: apps.id })
                    .from(apps)
                    .where(and(eq(apps.lang, lang), inArray(apps.id, appIds)))
            ).map((e) => e.id),
        );

        return appIds.filter((id) => !presentIds.has(id));
    }

    /**
     * Find apps missing player count estimates
     */
    private async findMissingPlayerEstimates(appIds: number[]): Promise<number[]> {
        const existingPlayerIds = new Set(
            (
                await this.db
                    .selectDistinct({ app_id: estimatedPlayers.app_id })
                    .from(estimatedPlayers)
                    .where(inArray(estimatedPlayers.app_id, appIds))
            ).map((e) => e.app_id),
        );

        return appIds.filter((id) => !existingPlayerIds.has(id));
    }

    /**
     * Intelligently fetch achievement metadata with fallback detection.
     * Checks database for English version first to avoid redundant API calls.
     */
    private async fetchAchievementMetaWithFallbackDetection(appId: number, requestedLang: APILanguageCode) {
        const isEnglish = requestedLang === "english";

        if (isEnglish) {
            // For English requests, just fetch from API
            const res = await this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang });
            if (res?.game?.availableGameStats?.achievements) {
                return {
                    requested: res.game.availableGameStats.achievements.map((ach) => ({
                        app_id: appId,
                        ach_id: ach.name,
                        display_name: ach.displayName,
                        default_value: ach.defaultvalue,
                        description: ach.description ?? undefined,
                        icon: ach.icon,
                        icon_gray: ach.icongray,
                        hidden: ach.hidden ? 1 : 0,
                    })),
                    english: null, // Not needed when requesting English
                    wasEnglishFromDb: false,
                };
            }
            return { requested: [], english: null, wasEnglishFromDb: false };
        }

        const existingEnglishMeta = await this.db
            .select({
                ach_id: achievementsMeta.ach_id,
                display_name: achievementsMeta.display_name,
                default_value: achievementsMeta.default_value,
                description: achievementsMeta.description,
                icon: achievementsMeta.icon,
                icon_gray: achievementsMeta.icon_gray,
                hidden: achievementsMeta.hidden,
            })
            .from(achievementsMeta)
            .where(and(eq(achievementsMeta.app_id, appId), eq(achievementsMeta.lang, "english")));

        const hasEnglishInDb = existingEnglishMeta.length > 0;

        if (hasEnglishInDb) {
            // We have English in DB, only fetch the requested language
            const requestedRes = await this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang });
            const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];

            return {
                requested: requestedAchievements.map((ach) => ({
                    app_id: appId,
                    ach_id: ach.name,
                    display_name: ach.displayName,
                    default_value: ach.defaultvalue,
                    description: ach.description ?? undefined,
                    icon: ach.icon,
                    icon_gray: ach.icongray,
                    hidden: ach.hidden ? 1 : 0,
                })),
                english: existingEnglishMeta.map((ach) => ({
                    app_id: appId,
                    ach_id: ach.ach_id,
                    display_name: ach.display_name,
                    default_value: ach.default_value,
                    description: ach.description ?? undefined,
                    icon: ach.icon,
                    icon_gray: ach.icon_gray,
                    hidden: ach.hidden,
                })),
                wasEnglishFromDb: true,
            };
        }

        // We don't have English in DB, fetch both requested language and English
        const [requestedRes, englishRes] = await Promise.all([
            this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang }),
            this.steamApi.getSchemaForGame({ appid: appId, l: "english" }),
        ]);

        const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];
        const englishAchievements = englishRes?.game?.availableGameStats?.achievements || [];

        return {
            requested: requestedAchievements.map((ach) => ({
                app_id: appId,
                ach_id: ach.name,
                display_name: ach.displayName,
                default_value: ach.defaultvalue,
                description: ach.description ?? undefined,
                icon: ach.icon,
                icon_gray: ach.icongray,
                hidden: ach.hidden ? 1 : 0,
            })),
            english: englishAchievements.map((ach) => ({
                app_id: appId,
                ach_id: ach.name,
                display_name: ach.displayName,
                default_value: ach.defaultvalue,
                description: ach.description ?? undefined,
                icon: ach.icon,
                icon_gray: ach.icongray,
                hidden: ach.hidden ? 1 : 0,
            })),
            wasEnglishFromDb: false,
        };
    }

    /**
     * Fetch and upsert comprehensive app data including achievements metadata and stats
     */
    private async fetchAndUpsertApps(appIds: number[]): Promise<Attempt<void, AttemptStatus>> {
        if (appIds.length === 0) return Attempt.ok(undefined);

        const timingId = generateTimingId();
        console.time(`${timingId} AppQueryComposer.fetchAndUpsertApps`);

        console.log(`🚀 Fetching ${appIds.length} missing apps with comprehensive data`);

        // Pre-check with language-agnostic tables to avoid redundant fetching
        const existingStatsRows = await this.db
            .selectDistinct({ app_id: achievementsStats.app_id, ach_id: achievementsStats.ach_id })
            .from(achievementsStats)
            .where(inArray(achievementsStats.app_id, appIds));

        const validData: Array<{
            appDetails: SteamAppRaw | null;
            appId: number;
            achievementStats: Array<{ app_id: number; ach_id: string; percent: number }> | undefined;
            achievementMeta: unknown;
        }> = [];

        let accumulatedError: Error | null = null;

        // Sequential processing: one Promise.all per app
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";

        // Use Attempt.all to fetch data for all apps, preserving partial successes
        const appDataAttempts = appIds.map(async (id) =>
            Attempt.try(async () => {
                // Fetch all data for this app in parallel
                const [appDetails, achievementMeta, achievementStats] = await Promise.all([
                    // App details (language-specific)
                    SteamStoreAPIClient.getAppDetails(id, { l: lang }).then((res) => Object.values(res)[0]?.data),
                    // Achievement metadata with smart translation detection
                    this.fetchAchievementMetaWithFallbackDetection(id, lang),
                    // Achievement stats (language-agnostic) - only if not already present
                    existingStatsRows.some((row) => row.app_id === id)
                        ? undefined // Don't fetch if already present
                        : this.steamApi.getGlobalAchievementPercentagesForApp({ gameid: id }).then((statsResponse) => {
                              if (statsResponse?.achievementpercentages?.achievements) {
                                  return statsResponse.achievementpercentages.achievements.map((ach) => ({
                                      app_id: id,
                                      ach_id: ach.name,
                                      percent: ach.percent,
                                  }));
                              }
                              return [];
                          }),
                ]);

                return {
                    appDetails: appDetails || null,
                    appId: id,
                    achievementStats,
                    achievementMeta,
                };
            }),
        );

        const appsResult = await Attempt.all(appDataAttempts);

        // Collect successful data
        if (appsResult.hasData()) {
            for (const appAttempt of appsResult.data) {
                if (appAttempt.hasData()) {
                    validData.push(appAttempt.data);
                }
            }
        }

        // Store the first error encountered
        if (appsResult.error && !accumulatedError) {
            accumulatedError = appsResult.error;
        }

        // Insert all successfully fetched data (database operation - let it throw)
        if (validData.length > 0) {
            console.time(`${timingId} AppQueryComposer.fetchAndUpsertApps:insertData`);
            // Prepare all data for insertion
            const appData = validData.map((data) => ({
                lang: lang,
                id: data.appId,
                data: data.appDetails,
            }));
            const achievementStatsData = validData
                .flatMap((data) => data.achievementStats)
                .filter((s) => s !== undefined);
            const achievementMetaData = validData.flatMap((data) => {
                const results = [];
                const achievementMeta = data.achievementMeta as {
                    requested: Array<{
                        app_id: number;
                        ach_id: string;
                        display_name: string;
                        default_value: number;
                        description: string | undefined;
                        icon: string;
                        icon_gray: string;
                        hidden: number;
                    }>;
                    english: Array<{
                        app_id: number;
                        ach_id: string;
                        display_name: string;
                        default_value: number;
                        description: string | undefined;
                        icon: string;
                        icon_gray: string;
                        hidden: number;
                    }> | null;
                    wasEnglishFromDb: boolean;
                };

                // Add the requested language achievements
                results.push(
                    ...achievementMeta.requested.map((meta) => ({
                        ...meta,
                        lang,
                    })),
                );

                // If we have English data from API (not from DB), also insert English records
                if (lang !== "english" && achievementMeta.english && !achievementMeta.wasEnglishFromDb) {
                    results.push(
                        ...achievementMeta.english.map((meta) => ({
                            ...meta,
                            lang: "english" as const,
                        })),
                    );
                }

                return results;
            });

            // Insert app details (this sets updated_at, indicating comprehensive fetch was attempted)
            await safeInsert(this.db, appData, (chunk) =>
                this.db
                    .insert(apps)
                    .values(chunk)
                    .onConflictDoUpdate({
                        target: [apps.id, apps.lang],
                        set: {
                            data: sql`excluded.data`,
                            updated_at: new Date(),
                        },
                    }),
            );
            // Insert achievement stats
            await safeInsert(this.db, achievementStatsData, (chunk) =>
                this.db
                    .insert(achievementsStats)
                    .values(chunk)
                    .onConflictDoUpdate({
                        target: [achievementsStats.app_id, achievementsStats.ach_id],
                        set: {
                            percent: sql`excluded.percent`,
                            updated_at: new Date(),
                        },
                    }),
            );
            // Insert achievement metadata
            await safeInsert(this.db, achievementMetaData, (chunk) =>
                this.db
                    .insert(achievementsMeta)
                    .values(chunk)
                    .onConflictDoUpdate({
                        target: [achievementsMeta.app_id, achievementsMeta.ach_id, achievementsMeta.lang],
                        set: {
                            display_name: sql`excluded.display_name`,
                            default_value: sql`excluded.default_value`,
                            description: sql`excluded.description`,
                            icon: sql`excluded.icon`,
                            icon_gray: sql`excluded.icon_gray`,
                            hidden: sql`excluded.hidden`,
                        },
                    }),
            );

            console.timeEnd(`${timingId} AppQueryComposer.fetchAndUpsertApps:insertData`);
        }

        console.timeEnd(`${timingId} AppQueryComposer.fetchAndUpsertApps`);

        // Return success or partial based on whether we encountered errors
        return Attempt.fromSimple(undefined, accumulatedError);
    }

    /**
     * Fetch and upsert player count estimates with full calculation
     */
    private async fetchAndUpsertPlayerEstimates(appIds: number[]): Promise<Attempt<void, AttemptStatus>> {
        if (appIds.length === 0) return Attempt.ok(undefined);

        const timingId = generateTimingId();
        console.time(`${timingId} AppQueryComposer.fetchAndUpsertPlayerEstimates`);

        const existingPlayersRows = await this.db
            .selectDistinct({ app_id: estimatedPlayers.app_id })
            .from(estimatedPlayers)
            .where(inArray(estimatedPlayers.app_id, appIds));

        const existingPlayerIds = new Set(existingPlayersRows.map((row) => row.app_id));
        const missingPlayerIds = appIds.filter((id) => !existingPlayerIds.has(id));

        if (missingPlayerIds.length === 0) {
            console.timeEnd(`${timingId} AppQueryComposer.fetchAndUpsertPlayerEstimates`);
            return Attempt.ok(undefined);
        }

        // Get app details for player estimation (database operation - let it throw)
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";
        const appDetailsRows = await this.db
            .select({ id: apps.id, data: apps.data })
            .from(apps)
            .where(and(inArray(apps.id, missingPlayerIds), eq(apps.lang, lang)));

        const appDetailsMap = new Map(
            appDetailsRows.filter((app) => app.data !== null).map((app) => [app.id, app.data]) as Array<
                [number, SteamAppRaw]
            >,
        );

        const playerCountData: Array<{ app_id: number; estimated_players: number | undefined }> = [];
        let accumulatedError: Error | null = null;

        // Use Attempt.all to handle player count estimation for all apps
        const playerEstimateAttempts = missingPlayerIds.map(async (appId) =>
            Attempt.try(async () => {
                const appDetails = appDetailsMap.get(appId);
                if (!appDetails) {
                    console.warn(`No app details found for app ${appId}, inserting null player estimate`);
                    // Still insert a record with null/undefined to mark that we attempted estimation
                    return {
                        app_id: appId,
                        estimated_players: undefined,
                    };
                }

                const playerCount = await Promise.all([
                    SteamStoreAPIClient.getAppReviews(appId, { num_per_page: "0" }),
                    SteamChartsAPIClient.getAppChartData(appId),
                ]).then(([appReviews, appPlayerCount]): number | undefined => {
                    if (!appReviews || !appPlayerCount) {
                        console.warn(`Missing review or chart data for app ${appId}`);
                        return 0;
                    }
                    const estimate = estimatePlayerCount({
                        all_time_peak: appPlayerCount.reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                        avg_count: appPlayerCount.reduce((acc, curr) => acc + curr[1], 0) / appPlayerCount.length,
                        day_peak: appPlayerCount
                            .filter((curr) => curr[0] > Date.now() / 1000 - 60 * 60 * 24)
                            .reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                        release_date_numeric: new Date(appDetails.release_date?.date ?? 0).getTime() / 1000,
                        review_score: appReviews.query_summary.review_score,
                        total_reviews: appReviews.query_summary.total_reviews,
                        is_free: appDetails.is_free ? 1 : 0,
                        price: appDetails.price_overview?.final ?? 0,
                    });
                    return estimate;
                });

                return {
                    app_id: appId,
                    estimated_players: playerCount,
                };
            }),
        );

        const estimatesResult = await Attempt.all(playerEstimateAttempts);

        // Collect successful data
        if (estimatesResult.hasData()) {
            for (const estimateAttempt of estimatesResult.data) {
                if (estimateAttempt.hasData()) {
                    playerCountData.push(estimateAttempt.data);
                }
            }
        }

        // Store the first error encountered
        if (estimatesResult.error && !accumulatedError) {
            accumulatedError = estimatesResult.error;
        }

        // Insert estimated player counts (database operation - let it throw)
        if (playerCountData.length > 0) {
            await safeInsert(this.db, playerCountData, (chunk) =>
                this.db
                    .insert(estimatedPlayers)
                    .values(chunk)
                    .onConflictDoUpdate({
                        target: estimatedPlayers.app_id,
                        set: {
                            estimated_players: sql`excluded.estimated_players`,
                            updated_at: new Date(),
                        },
                    }),
            );
        }

        console.timeEnd(`${timingId} AppQueryComposer.fetchAndUpsertPlayerEstimates`);

        // Return success or partial based on whether we encountered errors
        return Attempt.fromSimple(undefined, accumulatedError);
    }
}

export class AppRepository implements Repository<SteamApp, AppSortFilters, AppSortMethod> {
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private sqlite: DrizzleD1Database<any>,
        private steamApi: SteamAuthenticatedAPIClient,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): AppQueryComposer {
        return new AppQueryComposer(this.sqlite, this.steamApi);
    }

    /**
     * Fetch and upsert estimated player counts for the given app IDs.
     * Only fetches data for apps that don't already have player count estimates.
     */
    private async fetchAndUpsertEstimatedPlayers(
        appIds: number[],
        appDetailsMap: Map<number, SteamAppRaw>,
        timingId: string,
    ) {
        console.time(`${timingId} AppRepository.fetchAndUpsertEstimatedPlayers`);

        const existingPlayersRows = await this.sqlite
            .selectDistinct({ app_id: estimatedPlayers.app_id })
            .from(estimatedPlayers)
            .where(inArray(estimatedPlayers.app_id, Array.from(appIds)));

        const existingPlayerIds = new Set(existingPlayersRows.map((row) => row.app_id));
        const missingPlayerIds = appIds.filter((id) => !existingPlayerIds.has(id));

        if (missingPlayerIds.length === 0) {
            console.timeEnd(`${timingId} AppRepository.fetchAndUpsertEstimatedPlayers`);
            return;
        }

        const playerCountData: Array<{ app_id: number; estimated_players: number | undefined }> = [];

        try {
            for (const appId of missingPlayerIds) {
                const appDetails = appDetailsMap.get(appId);
                if (!appDetails) {
                    console.warn(`No app details found for app ${appId}, inserting null player estimate`);
                    // Still insert a record with null/undefined to mark that we attempted estimation
                    playerCountData.push({
                        app_id: appId,
                        estimated_players: undefined,
                    });
                    continue;
                }

                const playerCount = await Promise.all([
                    SteamStoreAPIClient.getAppReviews(appId, { num_per_page: "0" }),
                    SteamChartsAPIClient.getAppChartData(appId),
                ]).then(([appReviews, appPlayerCount]): number | undefined => {
                    if (!appReviews || !appPlayerCount) {
                        console.warn(`Missing review or chart data for app ${appId}`);
                        return 0;
                    }
                    const estimate = estimatePlayerCount({
                        all_time_peak: appPlayerCount.reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                        avg_count: appPlayerCount.reduce((acc, curr) => acc + curr[1], 0) / appPlayerCount.length,
                        day_peak: appPlayerCount
                            .filter((curr) => curr[0] > Date.now() / 1000 - 60 * 60 * 24)
                            .reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                        release_date_numeric: new Date(appDetails.release_date?.date ?? 0).getTime() / 1000,
                        review_score: appReviews.query_summary.review_score,
                        total_reviews: appReviews.query_summary.total_reviews,
                        is_free: appDetails.is_free ? 1 : 0,
                        price: appDetails.price_overview?.final ?? 0,
                    });
                    return estimate;
                });

                playerCountData.push({
                    app_id: appId,
                    estimated_players: playerCount,
                });
            }

            // Insert estimated player counts
            if (playerCountData.length > 0) {
                await safeInsert(this.sqlite, playerCountData, (chunk) =>
                    this.sqlite
                        .insert(estimatedPlayers)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: estimatedPlayers.app_id,
                            set: {
                                estimated_players: sql`excluded.estimated_players`,
                                updated_at: new Date(),
                            },
                        }),
                );
            }
        } catch (error) {
            console.warn(`Failed to fetch player estimates: ${error}`);
            throw error;
        }

        console.timeEnd(`${timingId} AppRepository.fetchAndUpsertEstimatedPlayers`);
    }

    /**
     * Intelligently fetch achievement metadata with fallback detection.
     * Checks database for English version first to avoid redundant API calls.
     */
    private async fetchAchievementMetaWithFallbackDetection(appId: number, requestedLang: APILanguageCode) {
        const isEnglish = requestedLang === "english";

        if (isEnglish) {
            // For English requests, just fetch from API
            const res = await this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang });
            if (res?.game?.availableGameStats?.achievements) {
                return {
                    requested: res.game.availableGameStats.achievements.map((ach) => ({
                        app_id: appId,
                        ach_id: ach.name,
                        display_name: ach.displayName,
                        default_value: ach.defaultvalue,
                        description: ach.description ?? undefined,
                        icon: ach.icon,
                        icon_gray: ach.icongray,
                        hidden: ach.hidden ? 1 : 0,
                    })),
                    english: null, // Not needed when requesting English
                    wasEnglishFromDb: false,
                };
            }
            return { requested: [], english: null, wasEnglishFromDb: false };
        }

        const existingEnglishMeta = await this.sqlite
            .select({
                ach_id: achievementsMeta.ach_id,
                display_name: achievementsMeta.display_name,
                default_value: achievementsMeta.default_value,
                description: achievementsMeta.description,
                icon: achievementsMeta.icon,
                icon_gray: achievementsMeta.icon_gray,
                hidden: achievementsMeta.hidden,
            })
            .from(achievementsMeta)
            .where(and(eq(achievementsMeta.app_id, appId), eq(achievementsMeta.lang, "english")));

        const hasEnglishInDb = existingEnglishMeta.length > 0;

        if (hasEnglishInDb) {
            // We have English in DB, only fetch the requested language
            const requestedRes = await this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang });
            const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];

            return {
                requested: requestedAchievements.map((ach) => ({
                    app_id: appId,
                    ach_id: ach.name,
                    display_name: ach.displayName,
                    default_value: ach.defaultvalue,
                    description: ach.description ?? undefined,
                    icon: ach.icon,
                    icon_gray: ach.icongray,
                    hidden: ach.hidden ? 1 : 0,
                })),
                english: existingEnglishMeta.map((ach) => ({
                    app_id: appId,
                    ach_id: ach.ach_id,
                    display_name: ach.display_name,
                    default_value: ach.default_value,
                    description: ach.description ?? undefined,
                    icon: ach.icon,
                    icon_gray: ach.icon_gray,
                    hidden: ach.hidden,
                })),
                wasEnglishFromDb: true,
            };
        }

        // We don't have English in DB, fetch both requested language and English
        const [requestedRes, englishRes] = await Promise.all([
            this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang }),
            this.steamApi.getSchemaForGame({ appid: appId, l: "english" }),
        ]);

        const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];
        const englishAchievements = englishRes?.game?.availableGameStats?.achievements || [];

        return {
            requested: requestedAchievements.map((ach) => ({
                app_id: appId,
                ach_id: ach.name,
                display_name: ach.displayName,
                default_value: ach.defaultvalue,
                description: ach.description ?? undefined,
                icon: ach.icon,
                icon_gray: ach.icongray,
                hidden: ach.hidden ? 1 : 0,
            })),
            english: englishAchievements.map((ach) => ({
                app_id: appId,
                ach_id: ach.name,
                display_name: ach.displayName,
                default_value: ach.defaultvalue,
                description: ach.description ?? undefined,
                icon: ach.icon,
                icon_gray: ach.icongray,
                hidden: ach.hidden ? 1 : 0,
            })),
            wasEnglishFromDb: false,
        };
    }

    async fetchPage(params: RepositoryParams<AppSortFilters, AppSortMethod>) {
        const timingId = generateTimingId();
        console.time(`${timingId} AppRepository.fetchPage`);
        const { filters, cursor, limit, lang, sort, search } = params;
        const l = getLanguageByCode(lang)?.apiCode || "english";

        const ids = new Set(filters.id);

        const terms = search ? searchTerms(sql`json_extract(${apps.data}, '$.name')`, search) : undefined;

        // Fetch summary to figure out what's missing
        console.time(`${timingId} AppRepository.fetchPage:checkExisting`);
        // TODO right now we're only fetching data if the app ID isn't found in apps table.
        // This means if for some reason we're missing metadata (specifically), there will be an error somewhere down the line.
        // This shouldn't happen in practice, but it would be correct to check for missing metadata as well, and refetch/upsert everything.
        const presentIds = new Set(
            (
                await this.sqlite
                    .selectDistinct({ id: apps.id })
                    .from(apps)
                    .where(and(eq(apps.lang, l), terms, inArray(apps.id, filters.id)))
            ).map((e) => e.id),
        );
        console.timeEnd(`${timingId} AppRepository.fetchPage:checkExisting`);

        const missingIds = presentIds.symmetricDifference(ids);

        // Check for missing estimated players independently of missing app data
        console.time(`${timingId} AppRepository.fetchPage:checkMissingPlayers`);
        const existingPlayerIds = new Set(
            (
                await this.sqlite
                    .selectDistinct({ app_id: estimatedPlayers.app_id })
                    .from(estimatedPlayers)
                    .where(inArray(estimatedPlayers.app_id, missingIds.values().toArray()))
            ) // TODO fix
                .map((e) => e.app_id),
        );
        const missingPlayerIds = Array.from(ids).filter((id) => !existingPlayerIds.has(id));
        console.timeEnd(`${timingId} AppRepository.fetchPage:checkMissingPlayers`);

        // Fetch comprehensive data (app + achievements) for missing IDs
        let accumulatedError: Error | null = null;

        if (missingIds.size > 0) {
            console.time(`${timingId} AppRepository.fetchPage:fetchMissing`);
            // Pre-check with language-agnostic tables to avoid redundant fetching
            const existingStatsRows = await this.sqlite
                .selectDistinct({ app_id: achievementsStats.app_id, ach_id: achievementsStats.ach_id })
                .from(achievementsStats)
                .where(inArray(achievementsStats.app_id, missingIds.values().toArray()));

            const validData: Array<{
                appDetails: SteamAppRaw | null;
                appId: number;
                achievementStats: Array<{ app_id: number; ach_id: string; percent: number }> | undefined;
                achievementMeta: unknown;
            }> = [];

            // Sequential processing: one Promise.all per app
            try {
                for (const id of missingIds) {
                    // If anything messes up in here (which it *will*, when rate limit), execution of this block will stop immediately
                    // This is intentional to avoid partial updates and ensure we only insert complete data

                    // Fetch all data for this app in parallel
                    const [appDetails, achievementMeta, achievementStats] = await Promise.all([
                        // App details (language-specific)
                        SteamStoreAPIClient.getAppDetails(id, { l }).then((res) => Object.values(res)[0]?.data),
                        // Achievement metadata with smart translation detection
                        this.fetchAchievementMetaWithFallbackDetection(id, l),
                        // Achievement stats (language-agnostic) - only if not already present
                        existingStatsRows
                            ? undefined // Don't fetch if already present
                            : this.steamApi
                                  .getGlobalAchievementPercentagesForApp({ gameid: id })
                                  .then((statsResponse) => {
                                      if (statsResponse?.achievementpercentages?.achievements) {
                                          return statsResponse.achievementpercentages.achievements.map((ach) => ({
                                              app_id: id,
                                              ach_id: ach.name,
                                              percent: ach.percent,
                                          }));
                                      }
                                      return [];
                                  }),
                    ]);

                    validData.push({
                        appDetails: appDetails || null,
                        appId: id,
                        achievementStats,
                        achievementMeta,
                    });
                }
            } catch (error) {
                console.warn(`Failed to fetch app data: ${error}`);
                if (!accumulatedError) {
                    accumulatedError = error as Error; // Store the first error encountered
                }
            }

            // Insert all successfully fetched data
            if (validData.length > 0) {
                console.time(`${timingId} AppRepository.fetchPage:insertData`);
                // Prepare all data for insertion
                const appData = validData.map((data) => ({
                    lang: l,
                    id: data.appId,
                    data: data.appDetails,
                }));
                const achievementStatsData = validData
                    .flatMap((data) => data.achievementStats)
                    .filter((s) => s !== undefined);
                const achievementMetaData = validData.flatMap((data) => {
                    const results = [];
                    const achievementMeta = data.achievementMeta as {
                        requested: Array<{
                            app_id: number;
                            ach_id: string;
                            display_name: string;
                            default_value: number;
                            description: string | undefined;
                            icon: string;
                            icon_gray: string;
                            hidden: number;
                        }>;
                        english: Array<{
                            app_id: number;
                            ach_id: string;
                            display_name: string;
                            default_value: number;
                            description: string | undefined;
                            icon: string;
                            icon_gray: string;
                            hidden: number;
                        }> | null;
                        wasEnglishFromDb: boolean;
                    };

                    // Add the requested language achievements (without individual translation status)
                    results.push(
                        ...achievementMeta.requested.map((meta) => ({
                            ...meta,
                            lang: l,
                        })),
                    );

                    // If we have English data from API (not from DB), also insert English records
                    if (l !== "english" && achievementMeta.english && !achievementMeta.wasEnglishFromDb) {
                        results.push(
                            ...achievementMeta.english.map((meta) => ({
                                ...meta,
                                lang: "english" as const,
                            })),
                        );
                    }

                    return results;
                });

                // Insert app details (this sets updated_at, indicating comprehensive fetch was attempted)
                await safeInsert(this.sqlite, appData, (chunk) =>
                    this.sqlite
                        .insert(apps)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: [apps.id, apps.lang],
                            set: {
                                data: sql`excluded.data`,
                                updated_at: new Date(),
                            },
                        }),
                );
                // Insert achievement stats
                await safeInsert(this.sqlite, achievementStatsData, (chunk) =>
                    this.sqlite
                        .insert(achievementsStats)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: [achievementsStats.app_id, achievementsStats.ach_id],
                            set: {
                                percent: sql`excluded.percent`,
                                updated_at: new Date(),
                            },
                        }),
                );
                // Insert achievement metadata
                await safeInsert(this.sqlite, achievementMetaData, (chunk) =>
                    this.sqlite
                        .insert(achievementsMeta)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: [achievementsMeta.app_id, achievementsMeta.ach_id, achievementsMeta.lang],
                            set: {
                                display_name: sql`excluded.display_name`,
                                default_value: sql`excluded.default_value`,
                                description: sql`excluded.description`,
                                icon: sql`excluded.icon`,
                                icon_gray: sql`excluded.icon_gray`,
                                hidden: sql`excluded.hidden`,
                            },
                        }),
                );

                console.timeEnd(`${timingId} AppRepository.fetchPage:insertData`);

                // Handle estimated players separately
                try {
                    const appDetailsMap = new Map(
                        validData
                            .map((data) => [data.appId, data.appDetails])
                            .filter(([, details]) => details !== null) as Array<[number, SteamAppRaw]>,
                    );
                    await this.fetchAndUpsertEstimatedPlayers(Array.from(missingIds), appDetailsMap, timingId);
                } catch (playerEstimateError) {
                    console.warn(`Failed to fetch player estimates: ${playerEstimateError}`);
                    // Don't set accumulated error for player estimates as they're non-critical
                }
            }
            console.timeEnd(`${timingId} AppRepository.fetchPage:fetchMissing`);
        }

        // Handle missing player estimates for apps that already exist in the database
        if (missingPlayerIds.length > 0) {
            console.time(`${timingId} AppRepository.fetchPage:fetchMissingPlayerEstimates`);
            try {
                // For apps that already exist, we need to fetch their details to calculate player estimates
                const existingAppDetails = await this.sqlite
                    .select({ id: apps.id, data: apps.data })
                    .from(apps)
                    .where(and(inArray(apps.id, missingPlayerIds), eq(apps.lang, l))); // TODO fix

                const appDetailsMap = new Map(
                    existingAppDetails.filter((app) => app.data !== null).map((app) => [app.id, app.data]) as Array<
                        [number, SteamAppRaw]
                    >,
                );

                await this.fetchAndUpsertEstimatedPlayers(missingPlayerIds, appDetailsMap, timingId);
            } catch (playerEstimateError) {
                console.warn(`Failed to fetch player estimates for existing apps: ${playerEstimateError}`);
                // Don't set accumulated error for player estimates as they're non-critical
            }
            console.timeEnd(`${timingId} AppRepository.fetchPage:fetchMissingPlayerEstimates`);
        }

        const sortDir = sort?.direction === "desc" ? desc : asc;
        const sortMethod = apps.id; // Currently only "id" is supported

        // Fetch fresh data from the database
        console.time(`${timingId} AppRepository.fetchPage:finalQuery`);
        const [appRows, estimatedPlayersRows] = await Promise.all([
            this.sqlite
                .select({
                    apps: apps,
                })
                .from(apps)
                .where(and(eq(apps.lang, l), inArray(apps.id, Array.from(ids)), terms ? sql`(${terms})` : undefined))
                .limit(limit ?? 10000)
                .offset(cursor ?? 0)
                .orderBy(sortDir(sortMethod)),
            this.sqlite
                .select({
                    estimated_players: estimatedPlayers,
                })
                .from(estimatedPlayers)
                .where(inArray(estimatedPlayers.app_id, Array.from(ids))),
        ]);
        console.timeEnd(`${timingId} AppRepository.fetchPage:finalQuery`);

        console.time(`${timingId} AppRepository.fetchPage:mapResults`);
        const filteredAppRows = appRows.filter((row) => row.apps.data !== null);
        const items = filteredAppRows.map(
            ({ apps }) =>
                new SteamApp({
                    // biome-ignore lint/style/noNonNullAssertion: <explanation>
                    data: apps.data!,
                    estimatedPlayers:
                        estimatedPlayersRows.find((ep) => ep.estimated_players.app_id === apps.id)?.estimated_players
                            .estimated_players ?? null,
                    lang: apps.lang,
                }),
        );
        console.timeEnd(`${timingId} AppRepository.fetchPage:mapResults`);

        console.timeEnd(`${timingId} AppRepository.fetchPage`);
        return new RepositoryResult<SteamApp>(items, (cursor ?? 0) + items.length, accumulatedError);
    }
}

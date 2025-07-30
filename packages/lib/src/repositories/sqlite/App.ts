import { type SQL, and, asc, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { WithSubqueryWithSelection } from "drizzle-orm/sqlite-core";
import {
    type APILanguageCode,
    Attempt,
    type AttemptStatus,
    type LanguageCode,
    achievementsMeta,
    achievementsStats,
    apps,
    estimatedPlayers,
    getFetchManager,
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
    type SubqueryConsumer,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import { safeInsert, searchTerms } from "./utils";

type AppSortMethod = "id";

export interface AppSortFilters {
    id: number;
}

class AppQueryComposer implements SubqueryConsumer<SteamApp, AppSortMethod> {
    private appIds: Set<number> = new Set();
    private whereConditions: SQL[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: I don't think there's a way to type this properly
    private ctes: WithSubqueryWithSelection<Record<string, any>, string>[] = [];
    private lang: LanguageCode = "en";
    private searchTerm?: string; /// TODO
    private requiredAppSubquery?: SQL; // For cross-repository data dependencies

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
     * Accept a subquery that defines which app entities are required
     * This enables cross-repository data dependency resolution without parameter explosion
     */
    withRequiredEntitySubquery(entityType: string, subquery: SQL): this {
        if (entityType === "apps") {
            this.requiredAppSubquery = subquery;
        }
        return this;
    }

    /**
     * Build and execute the composed query with error propagation
     */
    async build(options: ComposableQueryOptions<AppSortMethod> = {}): Promise<ComposableQueryResult<SteamApp>> {
        const timingId = generateTimingId();
        console.time(`${timingId} AppQueryComposer.build`);

        // First ensure all required data exists (this may accumulate errors)
        const ensureDataResult = await this.ensureDataExists();
        if (ensureDataResult.error) console.warn("Failed to ensure all data exists:", ensureDataResult.error);

        // Start with base query
        let query = this.db.select({ apps: apps }).from(apps).$dynamic();

        // Add CTEs if any exist, ensure they are applied to the main query
        // We need to redeclare because I guess "with" needs to be applied before select
        if (this.ctes.length > 0) {
            query = this.db
                .with(...this.ctes)
                .select({ apps: apps })
                .from(apps)
                .$dynamic();
        }

        // Add language filter and all other where conditions
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";
        const allConditions = [eq(apps.lang, lang), ...this.whereConditions];

        if (allConditions.length > 0) query = query.where(and(...allConditions));

        // Apply sorting
        if (options.sort) {
            const sortDir = options.sort.direction === "desc" ? desc : asc;
            const sortMethod = apps.id; // Currently only "id" is supported
            query = query.orderBy(sortDir(sortMethod));
        }

        // Apply pagination
        if (options.limit !== undefined) query = query.limit(options.limit);
        if (options.cursor !== undefined) query = query.offset(options.cursor);

        // Execute the main query
        const appRows = await query;

        // Get player estimates if required - use subquery to avoid parameter explosion
        let estimatedPlayersRows: Array<{
            estimated_players: typeof estimatedPlayers.$inferSelect;
        }> = [];
        if (appRows.length > 0) {
            // Build app IDs subquery with the same conditions as the main query
            let appIdsQuery = this.db.select({ id: apps.id }).from(apps).$dynamic();

            // Add CTEs if any exist
            if (this.ctes.length > 0) {
                appIdsQuery = this.db
                    .with(...this.ctes)
                    .select({ id: apps.id })
                    .from(apps)
                    .$dynamic();
            }

            // Add language filter and all other where conditions (same as main query)
            const lang = getLanguageByCode(this.lang)?.apiCode || "english";
            const allConditions = [eq(apps.lang, lang), ...this.whereConditions];
            if (allConditions.length > 0) {
                appIdsQuery = appIdsQuery.where(and(...allConditions));
            }

            estimatedPlayersRows = await this.db
                .select({
                    estimated_players: estimatedPlayers,
                })
                .from(estimatedPlayers)
                .where(inArray(estimatedPlayers.app_id, appIdsQuery));
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
        return createQueryResult(items, options.cursor, ensureDataResult.error);
    }

    /**
     * Ensure all required data exists in the database
     * Uses subqueries when available to avoid parameter explosion
     */
    async ensureDataExists(): Promise<Attempt<void, AttemptStatus>> {
        /*
            I'm putting this because I'll probably forget later. The reason this looks gross is because I've created a weird model:
            - If `apps` exists, then `achievements_meta` must exist in the same language
            - If `apps` exists, then `achievements_stats` must exist in a same-or-different language
            - `estimated_players` is independent from `apps` and can be deleted/recreated separately

            This results in us checking for "`apps`, et. all" separately from "`estimated_players`", then `findMissingApps` being responsible for figuring out what to fetch. This is because I removed the "updated_at" field on the `achievements_meta` and `achievements_stats` tables. A better solution probably exists.

            Ideally, player estimates would be fetched alongside the rest, but in practice I don't think it matters too much (different API entirely).
        */

        if (this.appIds.size === 0) return Attempt.ok(undefined);

        let accumulatedError: Error | null = null;

        // App fetching is most important probably, so we'll set a high limit for this one (3 requests * 150 apps = 450)
        getFetchManager().reset({ maxFetches: 450 });

        // Check for missing apps
        const missingAppIds = await this.findMissingApps();
        if (missingAppIds.length > 0) {
            console.log(`📦 Fetching ${missingAppIds.length} missing apps`);
            const appsResult = await this.fetchAndUpsertApps(missingAppIds);
            if (appsResult.error && !accumulatedError) {
                accumulatedError = appsResult.error;
            }
        }

        // Player estimates is still relatively important (in order for player count scores, see above comment)
        getFetchManager().reset({ maxFetches: 150 }); // (150 apps * 1 request per app = 150)

        // Check for missing player estimates
        const missingPlayerIds = await this.findMissingPlayerEstimates();
        if (missingPlayerIds.length > 0) {
            console.log(`📊 Fetching ${missingPlayerIds.length} missing player estimates`);
            const playerEstimatesResult = await this.fetchAndUpsertPlayerEstimates(missingPlayerIds);
            if (playerEstimatesResult.error && !accumulatedError) {
                accumulatedError = playerEstimatesResult.error;
            }
        }

        return Attempt.from(undefined, accumulatedError);
    }

    /**
     * Find apps that are missing from the database using Drizzle-based approach
     * Uses notExists for subqueries and inArray for consumer-controlled parameters
     */
    private async findMissingApps(): Promise<number[]> {
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";

        if (this.requiredAppSubquery) {
            // Use provided subquery from cross-repository dependency with notExists
            const missingAppsQuery = this.db
                .select({ app_id: sql<number>`required_apps.app_id` })
                .from(sql`(${this.requiredAppSubquery}) AS required_apps`)
                .where(
                    notExists(
                        this.db
                            .select()
                            .from(apps)
                            .where(and(eq(apps.id, sql`required_apps.app_id`), eq(apps.lang, lang))),
                    ),
                );

            const result = await missingAppsQuery;
            return result.map((row) => row.app_id);
        }

        if (this.appIds.size > 0) {
            // Consumer-controlled app IDs - safe to use inArray directly
            const appIdsArray = Array.from(this.appIds);
            const existingApps = await this.db
                .selectDistinct({ id: apps.id })
                .from(apps)
                .where(and(eq(apps.lang, lang), inArray(apps.id, appIdsArray)));

            const existingIds = new Set(existingApps.map((row) => row.id));
            return appIdsArray.filter((id) => !existingIds.has(id));
        }

        // No apps needed
        return [];
    }

    /**
     * Find apps missing player count estimates using Drizzle-based approach
     * Uses notExists for subqueries and inArray for consumer-controlled parameters
     */
    private async findMissingPlayerEstimates(): Promise<number[]> {
        if (this.requiredAppSubquery) {
            // Use provided subquery from cross-repository dependency with notExists
            const missingPlayerEstimatesQuery = this.db
                .select({ app_id: sql<number>`required_apps.app_id` })
                .from(sql`(${this.requiredAppSubquery}) AS required_apps`)
                .where(
                    notExists(
                        this.db
                            .select()
                            .from(estimatedPlayers)
                            .where(eq(estimatedPlayers.app_id, sql`required_apps.app_id`)),
                    ),
                );

            const result = await missingPlayerEstimatesQuery;
            return result.map((row) => row.app_id);
        }

        if (this.appIds.size > 0) {
            // Consumer-controlled app IDs - safe to use inArray directly
            const appIdsArray = Array.from(this.appIds);
            const existingPlayerEstimates = await this.db
                .selectDistinct({ app_id: estimatedPlayers.app_id })
                .from(estimatedPlayers)
                .where(inArray(estimatedPlayers.app_id, appIdsArray));

            const existingIds = new Set(existingPlayerEstimates.map((row) => row.app_id));
            return appIdsArray.filter((id) => !existingIds.has(id));
        }

        // No apps needed
        return [];
    }

    /**
     * Intelligently fetch achievement metadata with fallback detection.
     * Checks database for English version first to avoid redundant API calls.
     */
    private async fetchAchievementMetaWithFallbackDetection(appId: number, requestedLang: APILanguageCode) {
        const isEnglish = requestedLang === "english";

        if (isEnglish) {
            // For English requests, just fetch from API
            const res = await this.steamApi.getSchemaForGame({
                appid: appId,
                l: requestedLang,
            });
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
            const requestedRes = await this.steamApi.getSchemaForGame({
                appid: appId,
                l: requestedLang,
            });
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

        // Sequential processing: one Promise.all per app
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";

        // App data fetch helper
        // It's *really* important to do this app by app, rather than endpoint by endpoint,
        // because if we fail before hitting the last endpoint, we will have zero results.
        // By doing it this way, we are always guaranteed to have at least some results.
        const fetchAppData = async (id: number) => {
            const [appDetails, achievementMeta, achievementStats] = await Promise.all([
                // Language dependent queries
                SteamStoreAPIClient.getAppDetails(id, { l: lang }).then((res) => Object.values(res)[0]?.data),
                this.fetchAchievementMetaWithFallbackDetection(id, lang),
                // Always fetch stats - upsert logic will handle duplicates
                this.steamApi
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

            return {
                appDetails: appDetails || null,
                appId: id,
                achievementStats,
                achievementMeta,
            };
        };

        const validData = await Attempt.all(appIds.map((id) => fetchAppData(id)));

        // Insert all successfully fetched data (database operation - let it throw)
        if (validData.data.length > 0) {
            console.time(`${timingId} AppQueryComposer.fetchAndUpsertApps:insertData`);
            // Prepare all data for insertion
            const appData = validData.data.map((data) => ({
                lang: lang,
                id: data.appId,
                data: data.appDetails,
            }));
            const achievementStatsData = validData.data
                .flatMap((data) => data.achievementStats)
                .filter((s) => s !== undefined);
            const achievementMetaData = validData.data.flatMap((data) => {
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

        // Return our request attempt without any data (not needed)
        return validData.map(() => undefined);
    }

    /**
     * Fetch and upsert player count estimates with full calculation
     */
    private async fetchAndUpsertPlayerEstimates(appIds: number[]): Promise<Attempt<void, AttemptStatus>> {
        if (appIds.length === 0) return Attempt.ok(undefined);

        const timingId = generateTimingId();
        console.time(`${timingId} AppQueryComposer.fetchAndUpsertPlayerEstimates`);

        // Insert the app IDs we need to check into a temporary structure
        // and use composition to find missing estimates and get app details
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";

        // Create a CTE with required app IDs, then find missing estimates and get app details in one query
        const requiredAppsCTE = this.db.$with("required_apps").as(
            this.db
                .select({
                    app_id: sql<number>`value`.as("app_id"),
                })
                .from(
                    sql`(VALUES ${sql.join(
                        appIds.map((id) => sql`(${id})`),
                        sql`, `,
                    )}) AS t(value)`,
                ),
        );

        const appDetailsRows = await this.db
            .with(requiredAppsCTE)
            .select({
                id: apps.id,
                data: apps.data,
            })
            .from(requiredAppsCTE)
            .innerJoin(apps, eq(requiredAppsCTE.app_id, apps.id))
            .where(
                and(
                    eq(apps.lang, lang),
                    notExists(
                        this.db
                            .select({ app_id: estimatedPlayers.app_id })
                            .from(estimatedPlayers)
                            .where(eq(estimatedPlayers.app_id, requiredAppsCTE.app_id)),
                    ),
                ),
            );

        if (appDetailsRows.length === 0) {
            console.timeEnd(`${timingId} AppQueryComposer.fetchAndUpsertPlayerEstimates`);
            return Attempt.ok(undefined);
        }

        const appDetailsMap = new Map(
            appDetailsRows.filter((app) => app.data !== null).map((app) => [app.id, app.data]) as Array<
                [number, SteamAppRaw]
            >,
        );

        let accumulatedError: Error | null = null;

        // Use Attempt.all to handle player count estimation for all apps
        const playerEstimateAttempts = appDetailsRows.map(async (row) => {
            const appId = row.id;
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
            ]).then(([appReviews, appPlayerCount]) => {
                if (!appReviews || !appPlayerCount) {
                    console.warn(`Missing review or chart data for app ${appId}`);
                    return null;
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
        });

        const playerCountData = await Attempt.all(playerEstimateAttempts);
        if (playerCountData.error) accumulatedError = playerCountData.error;

        // Insert estimated player counts (database operation - let it throw)
        if (playerCountData.data.length > 0) {
            await safeInsert(this.db, playerCountData.data, (chunk) =>
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
        return Attempt.from(undefined, accumulatedError);
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
}

import { type SQL, and, asc, desc, eq, inArray, notExists, sql } from "drizzle-orm";
import type { WithSubqueryWithSelection } from "drizzle-orm/sqlite-core";
import {
    type APILanguageCode,
    Attempt,
    type AttemptStatus,
    type LanguageCode,
    type ProjectDB,
    type SteamAuthenticatedAPI,
    type SteamChartsAPI,
    type SteamStoreAPI,
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
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle CTE types are complex and vary by query
    private ctes: WithSubqueryWithSelection<any, string>[] = [];
    private lang: LanguageCode = "en";
    private searchTerm?: string; /// TODO
    // Store required apps subquery for cross-repository dependencies
    private requiredAppsSubquery?: SQL;

    constructor(
        private db: ProjectDB,
        private steamApi: SteamAuthenticatedAPI,
        private steamChartsApi: SteamChartsAPI,
        private steamStoreApi: SteamStoreAPI,
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
            // Store the raw SQL subquery for use in queries
            this.requiredAppsSubquery = subquery;
        }
        return this;
    }

    /**
     * Build and execute the composed query with error propagation
     */
    async build(options: ComposableQueryOptions<AppSortMethod> = {}): Promise<ComposableQueryResult<SteamApp>> {
        // Enforce explicit scope: either app IDs or a required-apps subquery must be provided
        if (this.appIds.size === 0 && this.requiredAppsSubquery === undefined) {
            throw new Error(
                "AppRepository.build(): undefined scope. Provide withAppIds(...) or withRequiredEntitySubquery('apps', ...).",
            );
        }

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

        if (this.appIds.size === 0 && this.requiredAppsSubquery === undefined) {
            return Attempt.ok(undefined);
        }

        let combinedResult: Attempt<undefined, AttemptStatus> = Attempt.ok(undefined);

        // App fetching is most important probably, so we'll set a high limit for this one (3 requests * 150 apps = 450)
        getFetchManager().reset({ maxFetches: 450 });

        // Check for missing apps
        const missingAppIds = await this.findMissingApps();
        if (missingAppIds.length > 0) {
            console.log(`📦 Fetching ${missingAppIds.length} missing apps`);
            const appsResult = await this.fetchAndUpsertApps(missingAppIds);
            combinedResult = combinedResult.and(appsResult);
        }

        // Player estimates is still relatively important (in order for player count scores, see above comment)
        getFetchManager().reset({ maxFetches: 150 }); // (150 apps * 1 request per app = 150)

        // Check for missing player estimates
        const missingPlayerIds = await this.findMissingPlayerEstimates();
        if (missingPlayerIds.length > 0) {
            console.log(`📊 Fetching ${missingPlayerIds.length} missing player estimates`);
            const playerEstimatesResult = await this.fetchAndUpsertPlayerEstimates(missingPlayerIds);
            combinedResult = combinedResult.and(playerEstimatesResult);
        }

        return combinedResult;
    }

    /**
     * Find apps that are missing from the database using Drizzle-based approach
     * Uses notExists for subqueries and inArray for consumer-controlled parameters
     */
    private async findMissingApps(): Promise<number[]> {
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";

        if (this.requiredAppsSubquery) {
            // Use provided subquery from cross-repository dependency with notExists
            const missingAppsQuery = this.db
                .select({ app_id: sql<number>`app_id`.as("app_id") })
                .from(sql`(${this.requiredAppsSubquery}) as required_apps`)
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
        if (this.requiredAppsSubquery) {
            // Use provided subquery from cross-repository dependency with notExists
            const missingPlayerEstimatesQuery = this.db
                .select({ app_id: sql<number>`app_id`.as("app_id") })
                .from(sql`(${this.requiredAppsSubquery}) as required_apps`)
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
        console.log(`🔤 Fetching achievement meta for app ${appId} with requested language: ${requestedLang}`);
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
        console.log(`🔤 App ${appId}: English in DB: ${hasEnglishInDb} (${existingEnglishMeta.length} achievements)`);

        if (hasEnglishInDb) {
            // We have English in DB, only fetch the requested language
            const requestedRes = await this.steamApi.getSchemaForGame({
                appid: appId,
                l: requestedLang,
            });
            const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];

            console.log(
                `🔤 App ${appId}: Found ${requestedAchievements.length} achievements in ${requestedLang} (with English from DB)`,
            );

            // Convert requested achievements to our format for comparison
            const requestedMapped = requestedAchievements.map((ach) => ({
                app_id: appId,
                ach_id: ach.name,
                display_name: ach.displayName,
                default_value: ach.defaultvalue,
                description: ach.description ?? undefined,
                icon: ach.icon,
                icon_gray: ach.icongray,
                hidden: ach.hidden ? 1 : 0,
            }));

            const englishMapped = existingEnglishMeta.map((ach) => ({
                app_id: appId,
                ach_id: ach.ach_id,
                display_name: ach.display_name,
                default_value: ach.default_value,
                description: ach.description ?? undefined,
                icon: ach.icon,
                icon_gray: ach.icon_gray,
                hidden: ach.hidden,
            }));

            // Achievement fallback detection logic:
            // 1. Compare [lang] vs English achievements by matching ach_id (not array position)
            // 2. If identical (same display_name, description), store ONLY English to avoid duplication
            // 3. [lang] app record is still created (for re-fetch prevention)
            // 4. UI will use Google Translate on English text when displaying in [lang]
            const requestedMap = new Map(requestedMapped.map((ach) => [ach.ach_id, ach]));
            const englishMap = new Map(englishMapped.map((ach) => [ach.ach_id, ach]));

            const areIdentical =
                requestedMapped.length === englishMapped.length &&
                requestedMapped.every((req) => {
                    const eng = englishMap.get(req.ach_id);
                    return (
                        eng &&
                        req.ach_id === eng.ach_id &&
                        req.display_name === eng.display_name &&
                        req.description === eng.description
                    );
                });

            console.log(
                `🔤 App ${appId}: Achievements identical: ${areIdentical} (${requestedMapped.length} vs ${englishMapped.length})`,
            );
            if (!areIdentical) {
                // Show first few differences for debugging
                let diffCount = 0;
                for (const req of requestedMapped) {
                    if (diffCount >= 3) break;

                    const eng = englishMap.get(req.ach_id);
                    if (!eng) {
                        console.log(
                            `🔤 App ${appId} diff #${diffCount}: Achievement "${req.ach_id}" exists in ${requestedLang} but not in English`,
                        );
                        diffCount++;
                    } else {
                        const nameMatch = req.display_name === eng.display_name;
                        const descMatch = req.description === eng.description;
                        if (!nameMatch || !descMatch) {
                            console.log(
                                `🔤 App ${appId} diff #${diffCount}: "${req.ach_id}" - Name(${nameMatch}): "${req.display_name}" vs "${eng.display_name}"`,
                            );
                            diffCount++;
                        }
                    }
                }
                // Check for English achievements missing in requested language
                for (const eng of englishMapped) {
                    if (diffCount >= 3) break;
                    if (!requestedMap.has(eng.ach_id)) {
                        console.log(
                            `🔤 App ${appId} diff #${diffCount}: Achievement "${eng.ach_id}" exists in English but not in ${requestedLang}`,
                        );
                        diffCount++;
                    }
                }
            }

            let result: {
                requested: typeof requestedMapped;
                english: typeof englishMapped;
                wasEnglishFromDb: boolean;
            };
            if (areIdentical) {
                console.log(
                    `🔤 App ${appId}: Achievements identical in ${requestedLang} and English (English from DB), storing only English version`,
                );
                result = {
                    requested: [], // Empty - use English fallback
                    english: englishMapped,
                    wasEnglishFromDb: true,
                };
            } else {
                console.log(
                    `🔤 App ${appId}: Achievements differ between ${requestedLang} and English (English from DB), storing both versions`,
                );
                result = {
                    requested: requestedMapped,
                    english: englishMapped,
                    wasEnglishFromDb: true,
                };
            }

            console.log(
                `🔤 App ${appId} fallback result (English from DB): requested=${result.requested.length}, english=${result.english.length}, wasEnglishFromDb=${result.wasEnglishFromDb}`,
            );
            return result;
        }

        // We don't have English in DB, fetch both requested language and English
        const [requestedRes, englishRes] = await Promise.all([
            this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang }),
            this.steamApi.getSchemaForGame({ appid: appId, l: "english" }),
        ]);

        const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];
        const englishAchievements = englishRes?.game?.availableGameStats?.achievements || [];

        console.log(
            `🔤 App ${appId}: Found ${requestedAchievements.length} achievements in ${requestedLang}, ${englishAchievements.length} in English`,
        );

        // Convert to our format for comparison
        const requestedMapped = requestedAchievements.map((ach) => ({
            app_id: appId,
            ach_id: ach.name,
            display_name: ach.displayName,
            default_value: ach.defaultvalue,
            description: ach.description ?? undefined,
            icon: ach.icon,
            icon_gray: ach.icongray,
            hidden: ach.hidden ? 1 : 0,
        }));

        const englishMapped = englishAchievements.map((ach) => ({
            app_id: appId,
            ach_id: ach.name,
            display_name: ach.displayName,
            default_value: ach.defaultvalue,
            description: ach.description ?? undefined,
            icon: ach.icon,
            icon_gray: ach.icongray,
            hidden: ach.hidden ? 1 : 0,
        }));

        // Achievement fallback detection logic (when English exists in DB):
        // 1. Compare newly fetched French vs existing English by matching ach_id
        // 2. If identical, store ONLY English to avoid duplication
        // 3. French app record is still created (prevents re-fetching)
        // 4. UserAchievement queries will fall back to English when French achievements missing
        const englishMap = new Map(englishMapped.map((ach) => [ach.ach_id, ach]));

        // TODO there are several faster ways to do this
        const areIdentical =
            requestedMapped.length === englishMapped.length &&
            requestedMapped.every((req) => {
                const eng = englishMap.get(req.ach_id);
                return (
                    eng &&
                    req.ach_id === eng.ach_id &&
                    req.display_name === eng.display_name &&
                    req.description === eng.description
                );
            });

        console.log(
            `🔤 App ${appId}: Achievements identical: ${areIdentical} (${requestedMapped.length} vs ${englishMapped.length})`,
        );

        let result: {
            requested: typeof requestedMapped;
            english: typeof englishMapped;
            wasEnglishFromDb: boolean;
        };
        if (areIdentical) {
            console.log(
                `🔤 App ${appId}: Achievements identical in ${requestedLang} and English, storing only English version`,
            );
            result = {
                requested: [], // Empty - use English fallback
                english: englishMapped,
                wasEnglishFromDb: false,
            };
        } else {
            console.log(
                `🔤 App ${appId}: Achievements differ between ${requestedLang} and English, storing both versions`,
            );
            result = {
                requested: requestedMapped,
                english: englishMapped,
                wasEnglishFromDb: false,
            };
        }

        console.log(
            `🔤 App ${appId} fallback result: requested=${result.requested.length}, english=${result.english.length}, wasEnglishFromDb=${result.wasEnglishFromDb}`,
        );
        return result;
    }

    /**
     * Fetch and upsert comprehensive app data including achievements metadata and stats
     */
    private async fetchAndUpsertApps(appIds: number[]): Promise<Attempt<undefined, AttemptStatus>> {
        if (appIds.length === 0) return Attempt.ok(undefined);

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
                this.steamStoreApi
                    .getAppDetails(id, { l: lang })
                    .then((res) => Object.values(res)[0]?.data || null),
                this.fetchAchievementMetaWithFallbackDetection(id, lang).catch((err) => {
                    console.warn(`Achievement meta fetch failed for app ${id}:`, err);
                    // For complete API failures, return null to indicate failure
                    // This will cause the entire app to be skipped
                    return null;
                }),
                // Always fetch stats - handle "no achievements" case gracefully
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
                        return []; // Empty array is valid for games with no achievements
                    })
                    .catch((err) => {
                        console.warn(`Achievement stats fetch failed for app ${id}:`, err);
                        // For apps with no achievements, Steam API might return errors (404, 400, etc.)
                        // Return empty array to indicate "no achievements" rather than "API failure"
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

        const attempt = await Attempt.all(appIds.map((id) => fetchAppData(id)));
        // Skip entire row only if the app details fetch completely failed
        // Note: achievementStats/achievementMeta can be empty arrays for games with no achievements (valid)
        // We now handle "no achievements" gracefully by returning empty arrays instead of undefined
        const validData = attempt.data.filter((d) => {
            return (
                d !== undefined && // fetchAppData didn't completely fail
                d.achievementStats !== undefined && // stats processing didn't fail (empty array is fine)
                d.achievementMeta !== undefined // meta processing didn't fail (empty arrays are fine)
            );
        });

        // Insert all successfully fetched data (database operation - let it throw)
        if (validData.length > 0) {
            // Data insertion logic:
            // - appData: Always insert French app record (prevents re-fetching French achievements)
            // - achievementStatsData: Always English (stats are language-agnostic)
            // - achievementMetaData: English only when identical, or both when different
            const appData = validData
                .filter((data) => data !== undefined)
                .map((data) => ({
                    lang: lang,
                    id: data.appId,
                    data: data.appDetails,
                }));

            // Count apps with/without achievements for logging
            const appsWithAchievements = validData.filter(
                (data) => data?.achievementStats && data.achievementStats.length > 0,
            ).length;
            const appsWithoutAchievements = validData.length - appsWithAchievements;

            console.log(
                `📊 Apps being processed: ${appsWithAchievements} with achievements, ${appsWithoutAchievements} without achievements`,
            );

            const achievementStatsData = validData
                .flatMap((data) => data?.achievementStats)
                .filter((s) => s !== undefined);
            const achievementMetaData = validData
                .flatMap((data) => {
                    const results = [];
                    const achievementMeta = data?.achievementMeta;

                    if (!achievementMeta || achievementMeta === null) return [];

                    // Add the requested language achievements
                    console.log(
                        `🔤 Adding ${achievementMeta.requested.length} achievements for app ${data.appId} with requested language: ${lang}`,
                    );
                    results.push(
                        ...achievementMeta.requested.map((meta) => ({
                            ...meta,
                            lang,
                        })),
                    );

                    // If we have English data from API (not from DB), also insert English records
                    if (lang !== "english" && achievementMeta.english && !achievementMeta.wasEnglishFromDb) {
                        console.log(
                            `🔤 Adding ${achievementMeta.english.length} English fallback achievements for app ${data.appId}`,
                        );
                        results.push(
                            ...achievementMeta.english.map((meta) => ({
                                ...meta,
                                lang: "english" as const,
                            })),
                        );
                    }

                    return results;
                })
                .filter((m) => m !== undefined);

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
        }

        // Return our request attempt without any data (not needed)
        return attempt.map(() => undefined);
    }

    /**
     * Fetch and upsert player count estimates with full calculation
     */
    private async fetchAndUpsertPlayerEstimates(appIds: number[]): Promise<Attempt<undefined, AttemptStatus>> {
        if (appIds.length === 0) return Attempt.ok(undefined);

        // Use composition to find missing estimates and get app details
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";

        let appDetailsRows: Array<{ id: number; data: unknown }>;

        if (this.requiredAppsSubquery) {
            // Use provided subquery from cross-repository dependency to avoid parameter explosion
            const requiredApps = sql`(${this.requiredAppsSubquery}) as required_apps`;
            appDetailsRows = await this.db
                .select({
                    id: apps.id,
                    data: apps.data,
                })
                .from(requiredApps)
                .innerJoin(apps, eq(sql`required_apps.app_id`, apps.id))
                .where(
                    and(
                        eq(apps.lang, lang),
                        notExists(
                            this.db
                                .select({ app_id: estimatedPlayers.app_id })
                                .from(estimatedPlayers)
                                .where(eq(estimatedPlayers.app_id, sql`required_apps.app_id`)),
                        ),
                    ),
                );
        } else {
            appDetailsRows = await this.db
                .select({
                    id: apps.id,
                    data: apps.data,
                })
                .from(apps)
                .where(
                    and(
                        eq(apps.lang, lang),
                        inArray(apps.id, appIds),
                        notExists(
                            this.db
                                .select({ app_id: estimatedPlayers.app_id })
                                .from(estimatedPlayers)
                                .where(eq(estimatedPlayers.app_id, apps.id)),
                        ),
                    ),
                );
        }

        if (appDetailsRows.length === 0) {
            return Attempt.ok(undefined);
        }

        const appDetailsMap = new Map(
            appDetailsRows.filter((app) => app.data !== null).map((app) => [app.id, app.data]) as Array<
                [number, SteamAppRaw]
            >,
        );

        const playerEstimateAttempts = appDetailsRows.map(async (row) => {
            const appId = row.id;
            const appDetails = appDetailsMap.get(appId);
            if (!appDetails) {
                console.warn(`No app details found for app ${appId}, inserting null player estimate`);
                // Still insert a record with null/undefined to mark that we attempted estimation
                return Attempt.ok({
                    app_id: appId,
                    estimated_players: null,
                });
            }

            getFetchManager().reset({ maxFetches: 200 });
            const playerCountData = await Attempt.all([
                this.steamStoreApi.getAppReviews(appId, { num_per_page: "0" }),
                this.steamChartsApi.getAppChartData(appId),
            ]);

            const playerCount = await playerCountData.chainAsync(async (data) => {
                const [appReviews, appPlayerCount] = data;

                // Only tolerate missing player count data by inserting a null estimate.
                if (appPlayerCount === undefined) {
                    return Attempt.ok(null);
                }

                // If reviews are missing or null, propagate an error (do not silently continue).
                if (appReviews == null) {
                    return Attempt.fail<number>(new Error(`Missing review or chart data for app ${appId}`));
                }

                // Sometimes chart data is null, so we'll just return null
                if (appPlayerCount === null) return Attempt.ok(null);

                // Narrow reviews to non-null after guards above
                const reviews = appReviews as NonNullable<typeof appReviews>;

                const estimate = await estimatePlayerCount({
                    all_time_peak: appPlayerCount.reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                    avg_count: appPlayerCount.reduce((acc, curr) => acc + curr[1], 0) / appPlayerCount.length,
                    day_peak: appPlayerCount
                        .filter((curr) => curr[0] > Date.now() / 1000 - 60 * 60 * 24)
                        .reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                    release_date_numeric: new Date(appDetails.release_date?.date ?? 0).getTime() / 1000,
                    review_score: reviews.query_summary.review_score,
                    total_reviews: reviews.query_summary.total_reviews,
                    is_free: appDetails.is_free ? 1 : 0,
                    price: appDetails.price_overview?.final ?? 0,
                });
                return Attempt.ok(estimate);
            });

            return playerCount.map((count) => ({
                app_id: appId,
                estimated_players: count,
            }));
        });

        const playerCountData = await Promise.all(playerEstimateAttempts);
        const filteredData = playerCountData.filter((d) => d.isOk()).map((d) => d.data);

        // Insert estimated player counts (database operation - let it throw)
        if (filteredData.length > 0) {
            await safeInsert(this.db, filteredData, (chunk) =>
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

        // Return success or partial based on whether we encountered errors
        const firstError = playerCountData.find((d) => d.isError());
        return Attempt.from(undefined, firstError ? firstError.error : null);
    }
}

export class AppRepository implements Repository<SteamApp, AppSortFilters, AppSortMethod> {
    constructor(
        private sqlite: ProjectDB,
        private steamApi: SteamAuthenticatedAPI,
        private steamChartsApi: SteamChartsAPI,
        private steamStoreApi: SteamStoreAPI,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): AppQueryComposer {
        return new AppQueryComposer(this.sqlite, this.steamApi, this.steamChartsApi, this.steamStoreApi);
    }
}

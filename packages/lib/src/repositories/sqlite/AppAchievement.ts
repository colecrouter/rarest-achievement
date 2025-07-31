import { type SQL, and, asc, desc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { type LanguageCode, achievementsStats, estimatedPlayers, getLanguageByCode } from "../..";
import type { SteamApp } from "../../models";
import { SteamAppAchievement } from "../../models";
import { generateTimingId } from "../../utils/timing";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type ComposableRepository,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import type { AppRepository } from "./App";
import { BaseAchievementQueryComposer } from "./BaseAchievement";
import { achievementsMeta } from "./schema";
import { getTableAliasedColumns } from "./utils";

export type AppAchievementSortMethod = "rarity_pct" | "rarity_score";

export interface AppAchievementFilters {
    appId: number;
    achId?: string;
}

class AppAchievementQueryComposer extends BaseAchievementQueryComposer<SteamAppAchievement, AppAchievementSortMethod> {
    private requiresEnglishFallback = false;

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        db: DrizzleD1Database<any>,
        private appRepository: AppRepository,
    ) {
        super(db);
    }

    /**
     * Set the language for this query and determine if English fallback is needed
     */
    withLanguage(lang: LanguageCode): this {
        super.withLanguage(lang);
        this.requiresEnglishFallback = lang !== "en";
        return this;
    }

    /**
     * Filter achievements by app IDs from a subquery (avoids parameter explosion)
     */
    withRequiredAppSubquery(appIdsSubquery: SQL): this {
        this.addEntitySubqueryCondition("apps", appIdsSubquery);
        return this;
    }

    /**
     * Build and execute the composed query
     */
    async build(
        options: ComposableQueryOptions<AppAchievementSortMethod> = {},
    ): Promise<ComposableQueryResult<SteamAppAchievement>> {
        const timingId = generateTimingId();
        console.time(`${timingId} AppAchievementQueryComposer.build`);

        // Ensure data exists and get any error information
        const ensureResult = await this.ensureDataExists();
        if (ensureResult.error) {
            console.warn(
                "Failed to ensure all achievement data exists, continuing with existing data:",
                ensureResult.error,
            );
        }

        const results = await this.executeMainQuery(options);

        console.timeEnd(`${timingId} AppAchievementQueryComposer.build`);
        return createQueryResult(results, options.cursor, ensureResult.error);
    }

    /**
     * Ensure all required data exists in the database
     */
    private async ensureDataExists(): Promise<ComposableQueryResult<SteamApp>> {
        if (this.appIds.size === 0) return createQueryResult([], 0, null);

        // Ensure app data exists by using the app repository
        return await this.appRepository
            .compose()
            .withLanguage(this.lang)
            .withAppIds(this.appIds)
            .build({
                sort: { method: "id", direction: "asc" },
            });
    }

    /**
     * Execute the main achievement query with all filters applied
     */
    private async executeMainQuery(
        options: ComposableQueryOptions<AppAchievementSortMethod>,
    ): Promise<SteamAppAchievement[]> {
        const timingId = generateTimingId();
        console.time(`${timingId} AppAchievementQueryComposer.executeMainQuery`);

        // Get apps that we'll need
        const appRows = await this.getAppData();

        // Build sorting
        const sortDir = options.sort?.direction === "desc" ? desc : asc;
        const sortMethod = this.getSortMethod(options.sort?.method || "rarity_pct");
        // Build main query
        const lang = getLanguageByCode(this.lang)?.apiCode || "english";
        let query = this.db
            .with(...this.ctes)
            .select({
                app_id: achievementsStats.app_id,
                ach_id: achievementsStats.ach_id,
                meta: getTableAliasedColumns(achievementsMeta),
                stats: getTableAliasedColumns(achievementsStats),
            })
            .from(achievementsStats)
            .leftJoin(
                achievementsMeta,
                and(
                    eq(achievementsStats.app_id, achievementsMeta.app_id),
                    eq(achievementsStats.ach_id, achievementsMeta.ach_id),
                    eq(achievementsMeta.lang, lang),
                ),
            )
            .innerJoin(estimatedPlayers, eq(achievementsStats.app_id, estimatedPlayers.app_id))
            .$dynamic();

        // Apply where conditions
        const allConditions = this.buildStandardWhereConditions();
        if (allConditions.length > 0) {
            // Filter out any undefined conditions and apply
            const definedConditions = allConditions.filter((condition): condition is SQL => condition !== undefined);
            if (definedConditions.length > 0) {
                query = query.where(and(...definedConditions));
            }
        }

        // Apply sorting and pagination
        query = query.orderBy(sortDir(sortMethod));

        if (options.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options.cursor !== undefined) {
            query = query.offset(options.cursor);
        }

        const data = await query;

        // Get English fallback metadata if needed
        const englishMetadata = await this.getEnglishFallbackMetadata(data);
        const englishMetaMap = new Map(englishMetadata.map((row) => [`${row.app_id}-${row.ach_id}`, row.meta]));

        // Map results to SteamAppAchievement objects
        const achievements = data
            .map((row) => {
                const app = appRows.find((a) => a.id === row.app_id);
                if (!app) return null;

                // Use English fallback if translation is missing
                const metaToUse = row.meta || englishMetaMap.get(`${row.app_id}-${row.ach_id}`);

                // If the primary metadata has null critical fields, use English fallback
                const englishFallback = englishMetaMap.get(`${row.app_id}-${row.ach_id}`);
                const shouldUseEnglishFallback =
                    metaToUse &&
                    (!metaToUse.ach_id || !metaToUse.icon || !metaToUse.icon_gray || !metaToUse.display_name);

                const finalMeta = shouldUseEnglishFallback ? englishFallback : metaToUse;

                // Determine effective language
                let effectiveLanguage = this.lang;
                if (!row.meta && englishMetaMap.has(`${row.app_id}-${row.ach_id}`)) {
                    effectiveLanguage = "en";
                } else if (row.meta && this.lang !== "en") {
                    const englishMeta = englishMetaMap.get(`${row.app_id}-${row.ach_id}`);
                    if (
                        englishMeta &&
                        row.meta.display_name === englishMeta.display_name &&
                        row.meta.description === englishMeta.description
                    ) {
                        effectiveLanguage = "en";
                    }
                }

                // Override effective language if we're using English fallback due to corruption
                if (shouldUseEnglishFallback) {
                    effectiveLanguage = "en";
                }

                if (!finalMeta) {
                    console.warn(`No metadata found for achievement ${row.ach_id} in app ${row.app_id}`);
                    return null;
                }

                const lang = getLanguageByCode(effectiveLanguage)?.apiCode || "english";
                return new SteamAppAchievement({
                    app,
                    meta: {
                        name: finalMeta.ach_id || row.ach_id, // Still fallback to stats ach_id if needed
                        defaultvalue: finalMeta.default_value,
                        description: finalMeta.description ?? undefined,
                        displayName: finalMeta.display_name,
                        hidden: finalMeta.hidden,
                        icon: finalMeta.icon,
                        icongray: finalMeta.icon_gray,
                    },
                    globalStats: {
                        name: row.ach_id,
                        percent: row.stats.percent,
                    },
                    lang,
                });
            })
            .filter((achievement) => achievement !== null);

        console.timeEnd(`${timingId} AppAchievementQueryComposer.executeMainQuery`);

        return achievements;
    }

    /**
     * Get app data for the achievements
     */
    private async getAppData() {
        if (this.appIds.size === 0) return [];

        const appResult = await this.appRepository
            .compose()
            .withLanguage(this.lang)
            .withAppIds(Array.from(this.appIds))
            .build({
                limit: 1000,
                sort: { method: "id", direction: "asc" },
            });

        return appResult.data || [];
    }

    /**
     * Get English fallback metadata when needed
     */
    private async getEnglishFallbackMetadata(
        data: { app_id: number; ach_id: string; meta: unknown; stats: unknown }[],
    ) {
        if (!this.requiresEnglishFallback || data.length === 0) return [];

        // This is exactly the same as the main query, but we filter for English metadata
        // We do this to serve the English achievement metadata when the requested language is not available
        // TODO compose with main query to avoid duplication, maybe avoid this func entirely & override `.withLanguage()` from parent class
        let query = this.db
            .with(...this.ctes)
            .select({
                app_id: achievementsMeta.app_id,
                ach_id: achievementsMeta.ach_id,
                meta: getTableAliasedColumns(achievementsMeta),
            })
            .from(achievementsStats)
            .innerJoin(
                achievementsMeta,
                and(
                    eq(achievementsStats.app_id, achievementsMeta.app_id),
                    eq(achievementsStats.ach_id, achievementsMeta.ach_id),
                    eq(achievementsMeta.lang, "english"), // Always English for fallback
                ),
            )
            .innerJoin(estimatedPlayers, eq(achievementsStats.app_id, estimatedPlayers.app_id))
            .$dynamic();

        // Apply the same where conditions as the main query
        const allConditions = this.buildStandardWhereConditions();
        if (allConditions.length > 0) {
            const definedConditions = allConditions.filter((condition): condition is SQL => condition !== undefined);
            if (definedConditions.length > 0) {
                query = query.where(and(...definedConditions));
            }
        }

        return await query;
    }

    /**
     * Get the appropriate sort method SQL
     */
    private getSortMethod(method: AppAchievementSortMethod) {
        switch (method) {
            case "rarity_pct":
                return achievementsStats.percent;
            case "rarity_score":
                return sql`CASE WHEN ${estimatedPlayers.estimated_players} IS NULL OR ${achievementsStats.percent} IS NULL THEN 1 ELSE 0 END, ${estimatedPlayers.estimated_players} * (${achievementsStats.percent} / 100)`;
            default:
                return achievementsStats.percent;
        }
    }
}
export class AppAchievementRepository
    implements
        Repository<SteamAppAchievement, AppAchievementFilters, AppAchievementSortMethod>,
        ComposableRepository<SteamAppAchievement, AppAchievementSortMethod, AppAchievementQueryComposer>
{
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private sqlite: DrizzleD1Database<any>,
        private appRepository: AppRepository,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): AppAchievementQueryComposer {
        return new AppAchievementQueryComposer(this.sqlite, this.appRepository);
    }
}

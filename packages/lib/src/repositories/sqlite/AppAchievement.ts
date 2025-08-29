import { type SQL, and, eq, sql } from "drizzle-orm";
import { type LanguageCode, type ProjectDB, achievementsStats, estimatedPlayers, getLanguageByCode } from "../..";
import type { SteamApp } from "../../models";
import { SteamAppAchievement } from "../../models";
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
import { Attempt, type AttemptStatus } from "../../error";

export type AppAchievementSortMethod = "rarity_pct" | "rarity_score";

export interface AppAchievementFilters {
    appId: number;
    achId?: string;
}

class AppAchievementQueryComposer extends BaseAchievementQueryComposer<SteamAppAchievement, AppAchievementSortMethod> {
    private requiresEnglishFallback = false;

    constructor(
        db: ProjectDB,
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
        // Store for downstream consumers and add to WHERE conditions
        this.withRequiredEntitySubquery("apps", appIdsSubquery);
        return this;
    }

    /**
     * Build and execute the composed query
     */
    async build(
        options: ComposableQueryOptions<AppAchievementSortMethod> = {},
    ): Promise<ComposableQueryResult<SteamAppAchievement>> {
        // Ensure data exists and get any error information
        const ensureResult = await this.ensureDataExists();
        if (ensureResult.error) {
            console.warn(
                "Failed to ensure all achievement data exists, continuing with existing data:",
                ensureResult.error,
            );
        }

        const results = await this.executeMainQuery(options);

        return createQueryResult(results, options.cursor, ensureResult.error);
    }

    /**
     * COUNT-only execution path matching current filters.
     * Preserves dual-storage semantics by ensuring app data exists prior to counting.
     * Reuses identical CTEs and WHERE stack as build(), but avoids ORDER BY/LIMIT and hydration.
     */
    async count(): Promise<Attempt<number, AttemptStatus>> {
        // Preserve dual-storage semantics; capture ensure error but continue to COUNT
        let ensureError: Error | null = null;
        try {
            const ensure = await this.ensureDataExists();
            ensureError = ensure.error;
        } catch (e) {
            // If ensure throws (e.g., DB layer failure), capture and still attempt COUNT
            ensureError = e as Error;
        }

        try {
            // COUNT distinct (app_id, ach_id) from achievementsStats with identical filter stack.
            // Avoid joins that could multiply rows. Leverage CTEs/EXISTS previously added by withRarityThreshold/withSearch/etc.
            let query = this.db
                .with(...this.ctes)
                .select({
                    count: sql<number>`count(distinct ${achievementsStats.app_id} || ':' || ${achievementsStats.ach_id})`,
                })
                .from(achievementsStats)
                .$dynamic();

            const allConditions = this.collectWhereConditions();
            if (allConditions.length > 0) {
                query = query.where(and(...allConditions));
            }

            const rows = await query;
            const count = rows[0]?.count ?? 0;

            // If the ensure step had an error but COUNT succeeded, propagate Partial
            if (ensureError) {
                return Attempt.partial(count, ensureError);
            }
            return Attempt.ok(count);
        } catch (err) {
            return Attempt.fail(err as Error);
        }
    }
    /**
     * Ensure all required data exists in the database
     */
    private async ensureDataExists(): Promise<ComposableQueryResult<SteamApp>> {
        // Determine scope: explicit app IDs or a subquery built from current filters
        const hasExplicitAppIds = this.appIds.size > 0;
        const requiredAppsSubquery =
            this.getRequiredEntitySubquery("apps") ??
            (hasExplicitAppIds ? undefined : this.buildAppsSubqueryForCurrentFilters());

        const composer = this.appRepository.compose().withLanguage(this.lang);

        if (hasExplicitAppIds) {
            composer.withAppIds(this.appIds);
        } else if (requiredAppsSubquery) {
            composer.withRequiredEntitySubquery("apps", requiredAppsSubquery);
        } else {
            return createQueryResult([], 0, null);
        }

        return await composer.build({
            sort: { method: "id", direction: "asc" },
        });
    }

    /**
     * Execute the main achievement query with all filters applied
     */
    private async executeMainQuery(
        options: ComposableQueryOptions<AppAchievementSortMethod>,
    ): Promise<SteamAppAchievement[]> {
        // Get apps that we'll need
        const appRows = await this.getAppData();

        // Build sorting helpers
        const effectiveSort = options.sort ?? { method: "rarity_pct", direction: "asc" as const };
        const sortPieces = this.buildRaritySortPieces(
            effectiveSort,
            achievementsStats.percent,
            estimatedPlayers.estimated_players,
        );
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
            .$dynamic();

        // Only join estimated players when sorting by player (rarity_score)
        if (this.isRarityScoreSort(options.sort)) {
            query = query.leftJoin(estimatedPlayers, eq(achievementsStats.app_id, estimatedPlayers.app_id));
        }

        // Apply where conditions
        const allConditions = this.collectWhereConditions(...sortPieces.where);
        if (allConditions.length > 0) {
            query = query.where(and(...allConditions));
        }

        // Apply sorting and pagination
        if (sortPieces.orderBy.length > 0) {
            query = query.orderBy(...sortPieces.orderBy);
        }

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

        return achievements;
    }

    /**
     * Get app data for the achievements
     */
    private async getAppData() {
        // If explicit app IDs were provided, fetch by IDs.
        if (this.appIds.size > 0) {
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

        // Otherwise, derive required apps from current filters (search, rarity, subqueries)
        const subquery = this.getRequiredEntitySubquery("apps") ?? this.buildAppsSubqueryForCurrentFilters();
        if (!subquery) return [];

        const bySub = await this.appRepository
            .compose()
            .withLanguage(this.lang)
            .withRequiredEntitySubquery("apps", subquery)
            .build({
                limit: 1000,
                sort: { method: "id", direction: "asc" },
            });
        return bySub.data || [];
    }

    /**
     * Get English fallback metadata when needed
     */
    private async getEnglishFallbackMetadata(
        data: { app_id: number; ach_id: string; meta: unknown; stats: unknown }[],
    ) {
        if (!this.requiresEnglishFallback || data.length === 0) return [];

        // This is similar to the main query, but we filter for English metadata only
        // We do this to serve the English achievement metadata when the requested language is not available
        // Note: no estimatedPlayers join here; fallback should work regardless of the current sort mode
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
            .$dynamic();

        // Apply the same where conditions as the main query
        const allConditions = this.collectWhereConditions();
        if (allConditions.length > 0) {
            query = query.where(and(...allConditions));
        }

        return await query;
    }

    // Use BaseAchievementQueryComposer's default buildAppsSubqueryForCurrentFilters implementation
}
export class AppAchievementRepository
    implements
        Repository<SteamAppAchievement, AppAchievementFilters, AppAchievementSortMethod>,
        ComposableRepository<SteamAppAchievement, AppAchievementSortMethod, AppAchievementQueryComposer>
{
    constructor(
        private sqlite: ProjectDB,
        private appRepository: AppRepository,
    ) {}

    /**
     * Create a new composable query builder
     */
    compose(): AppAchievementQueryComposer {
        return new AppAchievementQueryComposer(this.sqlite, this.appRepository);
    }
}

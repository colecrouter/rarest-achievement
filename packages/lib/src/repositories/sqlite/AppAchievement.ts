import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
    Attempt,
    type AttemptStatus,
    type LanguageCode,
    achievementsStats,
    estimatedPlayers,
    getLanguageByCode,
} from "../..";
import { SteamAppAchievement } from "../../models";
import { generateTimingId } from "../../utils/timing";
import {
    type ComposableQueryOptions,
    type ComposableQueryResult,
    type ComposableRepository,
    type QueryComposer,
    createQueryResult,
} from "../composable";
import type { Repository } from "../repository";
import type { AppRepository } from "./App";
import { achievementsMeta } from "./schema";
import { chunkArray, getTableAliasedColumns, searchTerms } from "./utils";

export type AppAchievementSortMethod = "rarity_pct" | "rarity_score";

export interface AppAchievementFilters {
    appId: number;
    achId?: string;
}

class AppAchievementQueryComposer implements QueryComposer<SteamAppAchievement, AppAchievementSortMethod> {
    private appIds: Set<number> = new Set();
    private achIds: Set<string> = new Set();
    private whereConditions: unknown[] = [];
    private requiresEnglishFallback = false;
    private searchTerm?: string;
    // TODO just copy from UserAchievementsQueryComposer, or extract common logic?
    // I shrugged off "base class" but honestly that's not a bad idea
    private rarityThreshold?: number;

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        private db: DrizzleD1Database<any>,
        private appRepository: AppRepository,
        private lang: LanguageCode = "en",
    ) {}

    /**
     * Set the language for this query
     */
    withLanguage(lang: LanguageCode): this {
        this.lang = lang;
        this.requiresEnglishFallback = lang !== "en";
        return this;
    }

    /**
     * Filter achievements by specific app IDs
     */
    withAppIds(appIds: number | Iterable<number>): this {
        if (typeof appIds === "number") {
            this.appIds.add(appIds);
        } else {
            for (const id of appIds) {
                this.appIds.add(id);
            }
        }

        this.whereConditions.push(inArray(achievementsStats.app_id, Array.from(this.appIds)));
        return this;
    }

    /**
     * Filter achievements by specific achievement IDs
     */
    withAchievementIds(achIds: string | Iterable<string>): this {
        if (typeof achIds === "string") {
            this.achIds.add(achIds);
        } else {
            for (const id of achIds) {
                this.achIds.add(id);
            }
        }

        this.whereConditions.push(inArray(achievementsStats.ach_id, Array.from(this.achIds)));
        return this;
    }

    /**
     * Filter achievements by rarity threshold (0-1 float, e.g. 0.05 for 5%)
     */
    withRarityThreshold(maxRarity: number): this {
        if (maxRarity < 0 || maxRarity > 1) {
            throw new Error(`Rarity threshold must be between 0 and 1, got ${maxRarity}`);
        }
        this.rarityThreshold = maxRarity * 100;
        this.whereConditions.push(sql`${achievementsStats.percent} <= ${this.rarityThreshold}`);
        return this;
    }

    /**
     * Filter achievements by search term (searches display name and description)
     */
    withSearch(search: string): this {
        this.searchTerm = search;

        // Create search conditions for both display_name and description
        const displayNameCondition = searchTerms(sql`${achievementsMeta.display_name}`, search);
        const descriptionCondition = searchTerms(sql`${achievementsMeta.description}`, search);

        // Combine with OR - achievement matches if either display name or description matches
        const searchCondition = sql`(${displayNameCondition} OR ${descriptionCondition})`;
        this.whereConditions.push(searchCondition);

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

        let accumulatedError: Error | null = null;

        // Ensure data exists and fetch main query
        try {
            await this.ensureDataExists();
        } catch (error) {
            accumulatedError = error as Error;
            console.warn("Failed to ensure all achievement data exists, continuing with existing data:", error);
        }

        const results = await this.executeMainQuery(options);

        console.timeEnd(`${timingId} AppAchievementQueryComposer.build`);
        return createQueryResult(results, options.cursor, accumulatedError);
    }

    /**
     * Ensure all required data exists in the database
     */
    private async ensureDataExists(): Promise<void> {
        if (this.appIds.size === 0) return;

        // Ensure app data exists by using the app repository
        await this.appRepository
            .compose()
            .withLanguage(this.lang)
            .withAppIds(this.appIds)
            .build({
                limit: 1000,
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
        if (this.whereConditions.length > 0) {
            // @ts-expect-error - Drizzle where condition types
            query = query.where(and(...this.whereConditions));
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

                if (!metaToUse) {
                    console.warn(`No metadata found for achievement ${row.ach_id} in app ${row.app_id}`);
                    return null;
                }

                const lang = getLanguageByCode(effectiveLanguage)?.apiCode || "english";
                return new SteamAppAchievement({
                    app,
                    meta: {
                        name: metaToUse.ach_id,
                        defaultvalue: metaToUse.default_value,
                        description: metaToUse.description ?? undefined,
                        displayName: metaToUse.display_name,
                        hidden: metaToUse.hidden,
                        icon: metaToUse.icon,
                        icongray: metaToUse.icon_gray,
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

        const allAchIds = data.map((row) => row.ach_id);
        const uniqueAppIds = Array.from(this.appIds);

        return await this.db
            .select({
                app_id: achievementsMeta.app_id,
                ach_id: achievementsMeta.ach_id,
                meta: getTableAliasedColumns(achievementsMeta),
            })
            .from(achievementsMeta)
            .where(and(inArray(achievementsMeta.app_id, uniqueAppIds), eq(achievementsMeta.lang, "english")))
            .then((rows) => rows.filter((row) => allAchIds.includes(row.ach_id)));
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

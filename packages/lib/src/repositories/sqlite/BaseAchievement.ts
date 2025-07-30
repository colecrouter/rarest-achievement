import { type SQL, and, eq, inArray, lte, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { WithSubqueryWithSelection } from "drizzle-orm/sqlite-core";
import { apps, getLanguageByCode, type LanguageCode } from "../..";
import type { ComposableQueryOptions, ComposableQueryResult, QueryComposer } from "../composable";
import { achievementsMeta, achievementsStats } from "./schema";
import { searchTerms } from "./utils";

/**
 * Base class for achievement-related query composers
 * Extracts common functionality like language handling, ID collection, rarity filtering, search, and subqueries
 */
export abstract class BaseAchievementQueryComposer<TResult, TSortMethod extends string>
    implements QueryComposer<TResult, TSortMethod>
{
    protected appIds: Set<number> = new Set();
    protected achIds: Set<string> = new Set();
    protected lang: LanguageCode = "en";
    protected searchTerm?: string;
    protected rarityThreshold?: number;
    protected requiredEntitySubqueries: Map<string, SQL> = new Map();
    protected whereConditions: SQL[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: I don't think there's a way to type this properly
    protected ctes: WithSubqueryWithSelection<Record<string, any>, string>[] = [];

    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: can't be unknown
        protected db: DrizzleD1Database<any>,
    ) {}

    /**
     * Set the language for this query
     */
    withLanguage(lang: LanguageCode): this {
        this.lang = lang;
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
    withAchievementIds(achIds: string | Iterable<string>): this {
        if (typeof achIds === "string") {
            this.achIds.add(achIds);
        } else {
            for (const id of achIds) {
                this.achIds.add(id);
            }
        }
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

        // Create CTE for achievements under rarity threshold
        const rareAchievementsCTE = this.db.$with("rare_achievements").as(
            this.db
                .selectDistinct({
                    app_id: achievementsStats.app_id,
                    ach_id: achievementsStats.ach_id,
                })
                .from(achievementsStats)
                .where(lte(achievementsStats.percent, this.rarityThreshold)),
        );

        this.ctes.push(rareAchievementsCTE);
        // Add WHERE conditions to filter by the CTE results
        this.whereConditions.push(
            inArray(
                achievementsStats.app_id,
                this.db.select({ app_id: rareAchievementsCTE.app_id }).from(rareAchievementsCTE),
            ),
        );
        this.whereConditions.push(
            inArray(
                achievementsStats.ach_id,
                this.db.select({ ach_id: rareAchievementsCTE.ach_id }).from(rareAchievementsCTE),
            ),
        );

        return this;
    }

    /**
     * Add search term for achievement names/descriptions
     */
    withSearch(search: string): this {
        this.searchTerm = search;

        const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

        // Create CTE for achievements matching search terms (including app names)
        const searchableAchievementsCTE = this.db.$with("searchable_achievements").as(
            this.db
                .selectDistinct({
                    app_id: achievementsMeta.app_id,
                    ach_id: achievementsMeta.ach_id,
                })
                .from(achievementsMeta)
                .innerJoin(apps, and(eq(achievementsMeta.app_id, apps.id), eq(apps.lang, apiCode)))
                .where(
                    or(
                        // Search in achievement metadata
                        searchTerms(achievementsMeta.display_name, search),
                        searchTerms(achievementsMeta.description, search),
                        // Search in app names
                        searchTerms(sql`json_extract(${apps.data}, '$.name')`, search),
                    ),
                ),
        );

        this.ctes.push(searchableAchievementsCTE);

        // Add WHERE condition to filter by the CTE results using subquery builders
        const matchingAppIdsQuery = this.db
            .select({ app_id: searchableAchievementsCTE.app_id })
            .from(searchableAchievementsCTE);
        const matchingAchIdsQuery = this.db
            .select({ ach_id: searchableAchievementsCTE.ach_id })
            .from(searchableAchievementsCTE);

        this.whereConditions.push(inArray(achievementsStats.app_id, matchingAppIdsQuery));
        this.whereConditions.push(inArray(achievementsStats.ach_id, matchingAchIdsQuery));

        return this;
    }

    /**
     * Accept a subquery that defines which entities are required
     * This enables cross-repository data dependency resolution without parameter explosion
     */
    withRequiredEntitySubquery(entityType: string, subquery: SQL): this {
        this.requiredEntitySubqueries.set(entityType, subquery);
        // Add to whereConditions for immediate use
        this.addEntitySubqueryCondition(entityType, subquery);
        return this;
    }

    /**
     * Get a stored subquery for a specific entity type
     */
    protected getRequiredEntitySubquery(entityType: string): SQL | undefined {
        return this.requiredEntitySubqueries.get(entityType);
    }

    /**
     * Add entity subquery condition to whereConditions (avoids parameter explosion)
     * This is a generic method that can be used for different entity types
     */
    protected addEntitySubqueryCondition(entityType: string, subquery: SQL): void {
        if (entityType === "apps") {
            this.whereConditions.push(inArray(achievementsStats.app_id, subquery));
        }
        // Could be extended for other entity types in the future
    }

    /**
     * Filter entities by subquery (avoids parameter explosion)
     * This is a generic method that can be used for different entity types
     * @deprecated Use addEntitySubqueryCondition instead
     */
    protected withEntitySubquery(entityType: string, subquery: SQL, whereConditions: SQL[]): void {
        if (entityType === "apps") {
            whereConditions.push(inArray(achievementsStats.app_id, subquery));
        }
        // Could be extended for other entity types in the future
    }

    /**
     * Table-specific helper methods for building WHERE conditions
     *
     * These functions allow shared filtering logic to work across different repositories
     * that use different table schemas. The base class provides defaults using achievementsStats,
     * while subclasses (like UserAchievement) override them to use their specific tables.
     *
     * Used by: buildStandardWhereConditions() and other shared filtering methods
     */

    /**
     * Create inArray condition for app IDs (helper for consistent column reference)
     * Subclasses can override this to use different table columns
     */
    protected createAppIdsCondition(appIds: number[]): SQL {
        return inArray(achievementsStats.app_id, appIds);
    }

    /**
     * Create inArray condition for achievement IDs (helper for consistent column reference)
     * Subclasses can override this to use different table columns
     */
    protected createAchievementIdsCondition(achIds: string[]): SQL {
        return inArray(achievementsStats.ach_id, achIds);
    }

    /**
     * Build all standard WHERE conditions (app IDs, achievement IDs)
     * Should be called before executing queries to ensure all conditions are included
     */
    protected buildStandardWhereConditions(): SQL[] {
        const conditions = [...this.whereConditions];

        // Add app IDs condition if we have any
        if (this.appIds.size > 0) {
            conditions.push(this.createAppIdsCondition(Array.from(this.appIds)));
        }

        // Add achievement IDs condition if we have any
        if (this.achIds.size > 0) {
            conditions.push(this.createAchievementIdsCondition(Array.from(this.achIds)));
        }

        return conditions;
    }

    /**
     * Abstract method that subclasses must implement
     */
    abstract build(options?: ComposableQueryOptions<TSortMethod>): Promise<ComposableQueryResult<TResult>>;
}

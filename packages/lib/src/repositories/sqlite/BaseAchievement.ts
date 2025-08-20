import { type SQL, and, asc, desc, eq, gt, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { SQLiteColumn, WithSubqueryWithSelection } from "drizzle-orm/sqlite-core";
import { type LanguageCode, type ProjectDB, apps, getLanguageByCode } from "../..";
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

    constructor(protected db: ProjectDB) {}

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
        // Add EXISTS condition to match on the (app_id, ach_id) pair
        this.whereConditions.push(
            sql`EXISTS (SELECT 1 FROM (${rareAchievementsCTE}) AS rare WHERE rare.app_id = ${this.getAppIdColumn()} AND rare.ach_id = ${this.getAchievementIdColumn()})`,
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

        // Add EXISTS condition to filter by the CTE (match on the (app_id, ach_id) pair)
        this.whereConditions.push(
            sql`EXISTS (SELECT 1 FROM (${searchableAchievementsCTE}) AS s WHERE s.app_id = ${this.getAppIdColumn()} AND s.ach_id = ${this.getAchievementIdColumn()})`,
        );

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
            // Use EXISTS with a raw SQL subquery to avoid driver limitations on IN (...subquery)
            // and to support callers that pass precompiled SQL via getSQL()
            this.whereConditions.push(
                sql`EXISTS (SELECT 1 FROM (${subquery}) AS required_apps WHERE required_apps.app_id = ${this.getAppIdColumn()})`,
            );
        }
        // Could be extended for other entity types in the future
    }

    // Column providers for table-agnostic filtering logic
    // Subclasses can override these to point at their own tables/columns
    protected getAppIdColumn(): SQLiteColumn {
        return achievementsStats.app_id;
    }

    protected getAchievementIdColumn(): SQLiteColumn {
        return achievementsStats.ach_id;
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
        return inArray(this.getAppIdColumn(), appIds);
    }

    /**
     * Create inArray condition for achievement IDs (helper for consistent column reference)
     * Subclasses can override this to use different table columns
     */
    protected createAchievementIdsCondition(achIds: string[]): SQL {
        return inArray(this.getAchievementIdColumn(), achIds);
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
     * Collect standard conditions plus any additional ones, filtering out undefined entries.
     */
    protected collectWhereConditions(...extra: Array<SQL | undefined>): SQL[] {
        const base = this.buildStandardWhereConditions();
        const extras = extra.filter((c): c is SQL => c !== undefined);
        return [...base, ...extras];
    }

    /**
     * Base table used for building required apps subqueries. Subclasses can override
     * when their filtering originates from a different table (e.g., user achievements).
     */
    // biome-ignore lint/suspicious/noExplicitAny: Drizzle Table generics aren't easily expressed here
    protected getAppSourceTable(): any {
        return achievementsStats;
    }

    /**
     * Build a subquery that selects the app IDs required by the current filters/CTEs.
     * Subclasses can override for custom logic; default uses the base table and standard filters.
     */
    protected getAppIdExpr(): SQL {
        return sql`${this.getAppIdColumn()}`;
    }

    protected buildAppsSubqueryForCurrentFilters(): SQL | undefined {
        let query = this.db
            .with(...this.ctes)
            .selectDistinct({
                app_id: this.getAppIdExpr(),
            })
            .from(this.getAppSourceTable())
            .$dynamic();

        const allConditions = this.buildStandardWhereConditions();
        const definedConditions = allConditions.filter((c): c is SQL => c !== undefined);
        if (definedConditions.length > 0) {
            query = query.where(and(...definedConditions));
        }

        return query.getSQL();
    }

    /**
     * Shared helper: detect player-driven rarity sort in a type-agnostic way.
     * Subclasses can use this to decide whether to require estimated players.
     */
    protected isRarityScoreSort(sort?: ComposableQueryOptions<TSortMethod>["sort"]): boolean {
        return String(sort?.method) === "rarity_score";
    }

    /**
     * Build common ORDER BY (and optional WHERE) pieces for rarity sorting.
     * - rarity_pct: simple percent ASC/DESC
     * - rarity_score: push NULLs to the end then order by (percent * estimated_players)
     * Returns the SQL fragments for orderBy and any where conditions to add.
     */
    protected buildRaritySortPieces(
        sort: ComposableQueryOptions<TSortMethod>["sort"] | undefined,
        percentColumn: SQLiteColumn,
        estimatedPlayersColumn: SQLiteColumn,
    ): { orderBy: SQL[]; where: SQL[] } {
        const fallback = { orderBy: [], where: [] } as { orderBy: SQL[]; where: SQL[] };
        if (!sort) return fallback;

        if (String(sort.method) === "rarity_pct") {
            const dir = sort.direction === "desc" ? desc : asc;
            return { orderBy: [dir(percentColumn)], where: [] };
        }

        if (String(sort.method) === "rarity_score") {
            const dir = sort.direction === "desc" ? desc : asc;
            const nullsLast = asc(
                sql`CASE WHEN ${percentColumn} IS NULL OR ${estimatedPlayersColumn} IS NULL THEN 1 ELSE 0 END`,
            );
            const score = dir(sql`${percentColumn} * ${estimatedPlayersColumn}`);
            return {
                orderBy: [nullsLast, score],
                // Ensure rows have a valid (positive) estimated player count when sorting by player-driven score
                where: [isNotNull(estimatedPlayersColumn), gt(estimatedPlayersColumn, 0)],
            };
        }

        return fallback;
    }

    /**
     * Abstract method that subclasses must implement
     */
    abstract build(options?: ComposableQueryOptions<TSortMethod>): Promise<ComposableQueryResult<TResult>>;
}

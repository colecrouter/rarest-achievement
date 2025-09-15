import { and, asc, desc, eq, exists, gt, inArray, isNotNull, isNull, lte, or, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { SubqueryWithSelection, WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import {
	type APILanguageCode,
	apps,
	getLanguageByAPICode,
	getLanguageByCode,
	type LanguageCode,
	type ProjectDB,
} from "../..";
import type { Attempt, AttemptStatus } from "../../error";
import type { ComposableQueryOptions, ComposableQueryResult, QueryComposer, RequiredSubquery } from "../composable";
import { RequiredEntityStore } from "../entitySubqueries";
import { caseWhen, coalesce, jsonExtract, multiply } from "./operators";
import { achievementsMeta, achievementsStats } from "./schema";
import { searchTerms } from "./utils";

export abstract class BaseAchievementQueryComposer<TResult, TSortMethod extends string>
	extends RequiredEntityStore<"app" | "ach">
	implements QueryComposer<TResult, TSortMethod>
{
	protected appIds: Set<number> = new Set();
	protected achIds: Set<string> = new Set();
	protected lang: LanguageCode = "en";
	protected searchTerm?: string;
	protected rarityThreshold?: number;
	/** Optional freshness cutoff for dependency ensure flows */
	protected freshnessCutoff?: Date;
	// biome-ignore lint/suspicious/noExplicitAny: I don't think there's a way to type this properly
	protected ctes: WithSubqueryWithSelection<Record<string, any>, string>[] = [];

	constructor(protected db: ProjectDB) {
		super(db, {
			app: achievementsStats.app_id,
			ach: achievementsStats.ach_id,
		});
	}

	/**
	 * Static helper to generate the COALESCE language fallback query used in achievement metadata joins.
	 * This ensures consistent language fallback logic across all achievement repositories.
	 *
	 * @param appIdColumn - The column containing the app_id (e.g., achievementsStats.app_id or userAchievements.app_id)
	 * @param achIdColumn - The column containing the ach_id (e.g., achievementsStats.ach_id or userAchievements.ach_id)
	 * @param apiCode - The requested API language code (e.g., "french", "german", etc.)
	 * @returns SQL expression for the COALESCE language fallback logic
	 */
	protected createLanguageFallbackCondition(
		appIdColumn: SQLiteColumn,
		achIdColumn: SQLiteColumn,
		apiCode: APILanguageCode,
	): SQL {
		return eq(
			achievementsMeta.lang,
			coalesce(
				this.db
					.select({ lang: achievementsMeta.lang })
					.from(achievementsMeta)
					.where(
						and(
							eq(achievementsMeta.app_id, appIdColumn),
							eq(achievementsMeta.ach_id, achIdColumn),
							eq(achievementsMeta.lang, apiCode),
						),
					)
					.limit(1),
				this.db
					.select({ lang: achievementsMeta.lang })
					.from(achievementsMeta)
					.where(
						and(
							eq(achievementsMeta.app_id, appIdColumn),
							eq(achievementsMeta.ach_id, achIdColumn),
							eq(achievementsMeta.lang, "english"),
						),
					)
					.limit(1),
			),
		);
	}

	/** Provide a required app subquery (selects { app_id }). Adds EXISTS(...) correlation automatically. */
	withRequiredApp(
		sub:
			| WithSubqueryWithSelection<{ app_id: unknown }, string>
			| SubqueryWithSelection<{ app_id: unknown }, string>,
	): this {
		this.withRequiredEntitySubquery(
			"app",
			sub as unknown as WithSubqueryWithSelection<{ app_id: unknown }, string>,
		);
		return this;
	}

	/** Provide a required achievement subquery (selects { ach_id }). Adds EXISTS(...) correlation automatically. */
	withRequiredAchievement(
		sub:
			| WithSubqueryWithSelection<{ ach_id: unknown }, string>
			| SubqueryWithSelection<{ ach_id: unknown }, string>,
	): this {
		this.withRequiredEntitySubquery("ach", sub);
		return this;
	}

	/**
	 * Set the language for this query
	 */
	withLanguage(lang: LanguageCode): this {
		this.lang = lang;
		return this;
	}

	/** Set freshness cutoff (optional override usage by subclasses) */
	withCutoff(cutoff: Date): this {
		this.freshnessCutoff = cutoff;
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
		// Use Drizzle exists() instead of raw SQL string for better type safety
		this.whereConditions.push(
			exists(
				this.db
					.select()
					.from(rareAchievementsCTE)
					.where(
						and(
							eq(rareAchievementsCTE.app_id, achievementsStats.app_id),
							eq(rareAchievementsCTE.ach_id, achievementsStats.ach_id),
						),
					),
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
						searchTerms(jsonExtract(apps.data, "name"), search),
					),
				),
		);

		this.ctes.push(searchableAchievementsCTE);

		// Add EXISTS condition to filter by the CTE (match on the (app_id, ach_id) pair)
		// Use Drizzle exists() instead of raw SQL string for better type safety
		this.whereConditions.push(
			exists(
				this.db
					.select()
					.from(searchableAchievementsCTE)
					.where(
						and(
							eq(searchableAchievementsCTE.app_id, achievementsStats.app_id),
							eq(searchableAchievementsCTE.ach_id, achievementsStats.ach_id),
						),
					),
			),
		);

		return this;
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
	 * Collect standard conditions plus any additional ones, filtering out undefined entries.
	 */
	protected collectWhereConditions(...extra: Array<SQL | undefined>): SQL[] {
		const base = this.buildStandardWhereConditions();
		const extras = extra.filter((c): c is SQL => c !== undefined);
		return [...base, ...extras];
	}

	/**
	 * Protected hook to build the app scope for the current filter stack.
	 * Subclasses with alternative roots (e.g. user-owned games) override this
	 * to remain fully compositional while reusing higher‑level ensure logic.
	 */
	protected buildRequiredAppsScope(): RequiredSubquery | undefined {
		// Base implementation: derive scope solely from achievementsStats + applied filters.
		let query = this.db
			.with(...this.ctes)
			.selectDistinct({ app_id: achievementsStats.app_id })
			.from(achievementsStats)
			.$dynamic();

		const allConditions = this.buildStandardWhereConditions();
		const definedConditions = allConditions.filter((c): c is SQL => c !== undefined);
		if (definedConditions.length > 0) query = query.where(and(...definedConditions));
		return query.as("required_apps") as unknown as RequiredSubquery;
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
				// sql`CASE WHEN ${percentColumn} IS NULL OR ${estimatedPlayersColumn} IS NULL THEN 1 ELSE 0 END`,
				caseWhen()
					.when(or(isNull(percentColumn), isNull(estimatedPlayersColumn)), 1)
					.else(0)
					.endNonNull(),
			);
			const score = dir(multiply(percentColumn, estimatedPlayersColumn));
			return {
				orderBy: [nullsLast, score],
				// Ensure rows have a valid (positive) estimated player count when sorting by player-driven score
				where: [isNotNull(estimatedPlayersColumn), gt(estimatedPlayersColumn, 0)],
			};
		}

		return fallback;
	}

	/**
	 * Unified helper for detecting effective language based on content comparison.
	 * Compares the row's display_name and description with English metadata to detect
	 * when API returned English data for a non-English request.
	 */
	protected detectEffectiveLanguage(
		requestedLang: LanguageCode,
		actualRowLang: string | null,
		displayName: string,
		description: string | null,
		englishMetaMap: Map<string, { display_name: string; description: string | null }>,
		appId: number,
		achId: string,
	): APILanguageCode {
		// If no actual row language (null), it means no translation available
		if (!actualRowLang) {
			return "english";
		}

		// If already English, return as "english"
		if (actualRowLang === "en" || actualRowLang === "english") {
			return "english";
		}

		// For non-English requests, check if content matches English
		if (requestedLang !== "en") {
			const englishMeta = englishMetaMap.get(`${appId}-${achId}`);
			if (englishMeta && displayName === englishMeta.display_name && description === englishMeta.description) {
				return "english"; // Content is English despite lang field
			}
		}

		// Return the actual row language, converted to API code
		const normalizedLang = actualRowLang === "english" ? "en" : actualRowLang;
		const langEntry = getLanguageByAPICode(normalizedLang as APILanguageCode);
		return langEntry?.apiCode || "english";
	}

	/**
	 * COUNT-only execution path.
	 * Abstract: subclasses must implement to support COUNT.
	 */
	abstract count(): Promise<Attempt<number, AttemptStatus>>;

	/**
	 * Abstract method that subclasses must implement
	 */
	abstract build(options?: ComposableQueryOptions<TSortMethod>): Promise<ComposableQueryResult<TResult>>;
}

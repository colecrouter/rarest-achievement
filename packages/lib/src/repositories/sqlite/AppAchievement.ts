import { and, eq, inArray, sql } from "drizzle-orm";
import type { SubqueryWithSelection, WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import { achievementsStats, estimatedPlayers, getLanguageByCode, type ProjectDB } from "../..";
import { Attempt, type AttemptStatus } from "../../error";
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

export type AppAchievementSortMethod = "rarity_pct" | "rarity_score";

// Legacy AppAchievementFilters removed: repository interface no longer carries filter generic

class AppAchievementQueryComposer extends BaseAchievementQueryComposer<SteamAppAchievement, AppAchievementSortMethod> {
	constructor(
		db: ProjectDB,
		private appRepository: AppRepository,
	) {
		super(db);
	}

	/**
	 * Provide freshness cutoff for dependent App repository ensure logic.
	 */
	withCutoff(cutoff: Date): this {
		this.freshnessCutoff = cutoff;
		return this;
	}

	/**
	 * Filter achievements by app IDs from a subquery (avoids parameter explosion)
	 */
	withRequiredApp(
		appIdsSubquery:
			| WithSubqueryWithSelection<{ app_id: unknown }, string>
			| SubqueryWithSelection<{ app_id: unknown }, string>,
	): this {
		// Store for downstream consumers and add to WHERE conditions (canonical key 'app')
		this.withRequiredEntitySubquery("app", appIdsSubquery);
		return this;
	}

	/**
	 * Build and execute the composed query
	 */
	async build(
		options: ComposableQueryOptions<AppAchievementSortMethod> = {},
	): Promise<ComposableQueryResult<SteamAppAchievement>> {
		// Consolidated ensure path via base hook
		const ensureAttempt = await this.ensureDependencies();
		if (ensureAttempt.error) {
			console.warn(
				"Failed to ensure all achievement dependencies exist, continuing with existing data:",
				ensureAttempt.error,
			);
		}

		const results = await this.executeDirectQuery(options);
		return createQueryResult(results, options.cursor, ensureAttempt.error);
	}

	/**
	 * COUNT-only execution path matching current filters.
	 * Preserves dual-storage semantics by ensuring app data exists prior to counting.
	 * Reuses identical CTEs and WHERE stack as build(), but avoids ORDER BY/LIMIT and hydration.
	 */
	async count(): Promise<Attempt<number, AttemptStatus>> {
		// Consolidated ensure path (capture partial error but proceed with COUNT)
		let ensureError: Error | null = null;
		try {
			const ensure = await this.ensureDependencies();
			ensureError = ensure.error;
		} catch (e) {
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
			this.getRequiredEntitySubquery("app") ?? (hasExplicitAppIds ? undefined : this.buildRequiredAppsScope());

		const composer = this.appRepository.compose().withLanguage(this.lang);
		if (this.freshnessCutoff) composer.withCutoff(this.freshnessCutoff);

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
	 * Execute the primary (direct) achievement query with all filters applied.
	 * Named executeDirectQuery to mirror naming in other composers (e.g. UserAchievementQueryComposer)
	 * for consistency across repositories.
	 */
	private async executeDirectQuery(
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

		// Always attempt fallback computation when a non-English language is requested;
		// the helper scopes the fetch to only rows missing valid metadata to avoid waste.
		const englishFallbackRows = await this.getEnglishFallbackMetadata(data);
		const englishMetaMap = new Map(englishFallbackRows.map((row) => [`${row.app_id}-${row.ach_id}`, row.meta]));

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
		const subquery = this.getRequiredEntitySubquery("app") ?? this.buildRequiredAppsScope();
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
	 * @todo clean this up
	 */
	private async getEnglishFallbackMetadata(
		data: { app_id: number; ach_id: string; meta: unknown; stats: unknown }[],
	) {
		// Fast bail-outs
		if (data.length === 0) return [];
		if (this.lang === "en") return [];

		// Determine which rows actually need fallback (missing meta or critical fields)
		const missing: Array<{ app_id: number; ach_id: string }> = [];
		for (const row of data) {
			const m = row.meta as {
				ach_id: string | null;
				icon: string | null;
				icon_gray: string | null;
				display_name: string | null;
			} | null;
			if (!m || !m.display_name || !m.icon || !m.icon_gray) {
				missing.push({ app_id: row.app_id, ach_id: row.ach_id });
			}
		}
		if (missing.length === 0) return [];

		// Scope fallback fetch to affected app_ids only to keep parameter count low.
		const appIds = Array.from(new Set(missing.map((r) => r.app_id)));

		const fallbackQuery = this.db
			.select({
				app_id: achievementsMeta.app_id,
				ach_id: achievementsMeta.ach_id,
				meta: getTableAliasedColumns(achievementsMeta),
			})
			.from(achievementsMeta)
			.where(and(eq(achievementsMeta.lang, "english"), inArray(achievementsMeta.app_id, appIds)))
			.$dynamic();

		return await fallbackQuery;
	}

	/**
	 * Consolidated ensure hook implementation for BaseAchievement.
	 * Converts the existing ensureDataExists result into an Attempt<void> while preserving error state.
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	protected async ensureDependencies(): Promise<Attempt<void, AttemptStatus>> {
		const res = await this.ensureDataExists();
		return Attempt.from(undefined, res.error);
	}
}
export class AppAchievementRepository
	implements
		Repository<SteamAppAchievement, AppAchievementSortMethod>,
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

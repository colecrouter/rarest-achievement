import { and, countDistinct, eq } from "drizzle-orm";
import type { SubqueryWithSelection, WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import { achievementsStats, estimatedPlayers, getLanguageByAPICode, getLanguageByCode, type ProjectDB } from "../..";
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
import { concat } from "./operators";
import { achievementsMeta } from "./schema";
import { getTableAliasedColumns } from "./utils";

export type AppAchievementSortMethod = "rarity_pct" | "rarity_score";

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
			console.warn(`[AppAchievementRepository] Failed to ensure all data exists: ${ensureAttempt.error.message}`);
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
		const ensureAttempt = await this.ensureDependencies();
		if (ensureAttempt.error)
			console.warn(`[AppAchievementRepository] Failed to ensure all data exists: ${ensureAttempt.error.message}`);

		// COUNT distinct (app_id, ach_id) from achievementsStats with identical filter stack.
		// Avoid joins that could multiply rows. Leverage CTEs/EXISTS previously added by withRarityThreshold/withSearch/etc.
		const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";
		let query = this.db
			.with(...this.ctes)
			.select({
				count: countDistinct(concat(achievementsStats.app_id, ":", achievementsStats.ach_id)),
			})
			.from(achievementsStats)
			.innerJoin(
				achievementsMeta,
				and(
					eq(achievementsStats.app_id, achievementsMeta.app_id),
					eq(achievementsStats.ach_id, achievementsMeta.ach_id),
					super.createLanguageFallbackCondition(achievementsStats.app_id, achievementsStats.ach_id, apiCode),
				),
			)
			.$dynamic();

		const allConditions = this.collectWhereConditions();
		if (allConditions.length > 0) {
			query = query.where(and(...allConditions));
		}

		const rows = await query;
		const count = rows[0]?.count ?? 0;
		return ensureAttempt.map(() => count);
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

		// This path doesn't actually fetch its own data, so no API calls/try-catch needed
		// Just return the result of the Apps ensure operation
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
		const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";
		let query = this.db
			.with(...this.ctes)
			.select({
				app_id: achievementsStats.app_id,
				ach_id: achievementsStats.ach_id,
				meta: getTableAliasedColumns(achievementsMeta),
				stats: getTableAliasedColumns(achievementsStats),
			})
			.from(achievementsStats)
			.innerJoin(
				achievementsMeta,
				and(
					eq(achievementsStats.app_id, achievementsMeta.app_id),
					eq(achievementsStats.ach_id, achievementsMeta.ach_id),
					super.createLanguageFallbackCondition(achievementsStats.app_id, achievementsStats.ach_id, apiCode),
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

		// Map results to SteamAppAchievement objects
		const achievements = data
			.map((row) => {
				const app = appRows.find((a) => a.id === row.app_id);
				if (!app) return null;

				// With INNER JOIN + COALESCE, we should always have valid metadata
				const metaToUse = row.meta;
				if (!metaToUse) return null;

				// Determine effective language using unified detection
				const actualRowLang = row.meta?.lang || null;
				const detectedApiCode = this.detectEffectiveLanguage(
					this.lang,
					actualRowLang,
					metaToUse.display_name,
					metaToUse.description,
					new Map(), // No fallback map needed since COALESCE handles it
					row.app_id,
					row.ach_id,
				);
				// Convert API code back to store code for consistency
				const langEntry = getLanguageByAPICode(detectedApiCode);
				const effectiveLanguage = langEntry?.storeCode || "en";

				const lang = getLanguageByCode(effectiveLanguage)?.apiCode || "english";
				return new SteamAppAchievement({
					app,
					meta: {
						name: metaToUse.ach_id || row.ach_id, // Still fallback to stats ach_id if needed
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
	 * Consolidated ensure hook implementation for BaseAchievement.
	 * Converts the existing ensureDataExists result into an Attempt<void> while preserving error state.
	 */
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

import { and, asc, countDistinct, desc, eq, gte, inArray, notExists, or, type SQL, sql } from "drizzle-orm";
import type { WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import {
	type APILanguageCode,
	Attempt,
	type AttemptStatus,
	achievementsMeta,
	achievementsStats,
	apps,
	estimatedPlayers,
	friends,
	getFetchManager,
	getLanguageByCode,
	type LanguageCode,
	ownedGames,
	type ProjectDB,
	type SteamAuthenticatedAPI,
	type SteamChartsAPI,
	type SteamStoreAPI,
	steamChartsSnapshots,
} from "../..";
import { estimatePlayerCount } from "../../ml/playerEstimate";
import { SteamApp, type SteamAppRaw } from "../../models";
import type { ChartDataPoint, GetAppChartDataResponse } from "../api/steamcharts/types";
import {
	type ComposableQueryOptions,
	type ComposableQueryResult,
	createQueryResult,
	type RequiredSubquery,
	type SubqueryConsumer,
} from "../composable";
import type { Repository } from "../repository";
import { excluded, jsonExtract } from "./operators";
import { safeInsert, searchTerms } from "./utils";

type AppSortMethod = "id";

const RECENT_STEAM_CHART_POINTS_LIMIT = 120;

type SteamChartsSnapshot = {
	allTimePeak: number;
	avgCount: number;
	dayPeak: number;
	recentPoints: ChartDataPoint[];
};

function getRecentSteamChartPoints(chartData: GetAppChartDataResponse): ChartDataPoint[] {
	const configuredLimit = Math.floor(RECENT_STEAM_CHART_POINTS_LIMIT);
	const limit = Number.isFinite(configuredLimit) ? Math.max(0, configuredLimit) : 0;
	if (limit === 0) return [];
	return chartData.slice(-limit);
}

function summarizeSteamChartsData(chartData: GetAppChartDataResponse): SteamChartsSnapshot | null {
	if (chartData.length === 0) return null;

	const dayCutoff = Date.now() / 1000 - 60 * 60 * 24;
	let allTimePeak = 0;
	let total = 0;
	let dayPeak = 0;

	for (const point of chartData) {
		const [timestamp, value] = point;
		allTimePeak = Math.max(allTimePeak, value);
		total += value;
		if (timestamp > dayCutoff) dayPeak = Math.max(dayPeak, value);
	}

	return {
		allTimePeak,
		avgCount: total / chartData.length,
		dayPeak,
		recentPoints: getRecentSteamChartPoints(chartData),
	};
}

// Precise CTE type for "required apps" subquery: must expose a single column "app_id"
type RequiredAppsSubquery = WithSubqueryWithSelection<{ app_id: typeof apps.id }, string>;

class AppQueryComposer implements SubqueryConsumer<SteamApp, AppSortMethod> {
	private appIds: Set<number> = new Set();
	private whereConditions: SQL[] = [];
	// biome-ignore lint/suspicious/noExplicitAny: Drizzle CTE types are complex and vary by query
	private ctes: WithSubqueryWithSelection<any, string>[] = [];
	private lang: LanguageCode = "en";
	private searchTerm?: string; /// TODO
	// Store required apps subquery for cross-repository dependencies
	private requiredAppsSubquery?: RequiredAppsSubquery;
	/** When true, prefer small FIFO and micro-batch inserts to minimize memory (used by unlocked_at ensure path) */
	private unlockedAtMode = false;
	/** If set, treat rows with updated_at older than this Date as missing */
	private freshnessCutoff: Date | undefined;

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
	 * Filter apps owned by friends of a specific user without materializing the full friend ID list
	 * This avoids large IN (...) parameter lists that can trigger SQLite / D1 limits.
	 *
	 * Implementation details:
	 * - friend_user_ids CTE: SELECT DISTINCT friend_id FROM friends WHERE user_id = <userId>
	 * - owned_apps CTE: SELECT DISTINCT app_id FROM ownedGames WHERE ownedGames.user_id IN (SELECT user_id FROM friend_user_ids)
	 * - Main query filters apps.id IN (SELECT app_id FROM owned_apps)
	 */
	withOwnedByFriendsOf(userId: string): this {
		if (!userId) return this;

		const friendIdsCTE = this.db
			.$with("friend_user_ids")
			.as(
				this.db.selectDistinct({ user_id: friends.friend_id }).from(friends).where(eq(friends.user_id, userId)),
			);
		this.ctes.push(friendIdsCTE);

		const ownedAppsCTE = this.db.$with("owned_apps").as(
			this.db
				.selectDistinct({ app_id: ownedGames.app_id })
				.from(ownedGames)
				.where(
					inArray(ownedGames.user_id, this.db.select({ user_id: friendIdsCTE.user_id }).from(friendIdsCTE)),
				),
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
	withSearch(query: string): this {
		if (!query || query.trim() === "") return this;

		this.searchTerm = query;

		const nameExpr = jsonExtract(apps.data, "name");
		const descExpr = jsonExtract(apps.data, "short_description");

		// OR across each column; each searchTerms() ensures all tokens appear in that column
		const condition = or(searchTerms(nameExpr, query), searchTerms(descExpr, query)) ?? sql`1=1`;

		this.whereConditions.push(condition);
		return this;
	}

	/**
	 * Accept a subquery that defines which app entities are required
	 * This enables cross-repository data dependency resolution without parameter explosion
	 */
	withRequiredEntitySubquery(entityType: string, subquery: RequiredSubquery): this {
		if (entityType === "apps") {
			// Store the raw SQL subquery for use in queries. Narrow to the expected selection shape.
			this.requiredAppsSubquery = subquery as unknown as RequiredAppsSubquery;
		}
		return this;
	}

	/**
	 * Toggle unlocked_at mode. When enabled, ensure paths avoid flatten-then-insert and
	 * stream per-app inserts in micro-batches to keep memory bounded.
	 */
	withUnlockedAtMode(enabled: boolean): this {
		this.unlockedAtMode = !!enabled;
		return this;
	}

	/**
	 * Provide a freshness cutoff; any existing app / player estimate rows older than this will be re-fetched
	 */
	withCutoff(cutoff: Date): this {
		this.freshnessCutoff = cutoff;
		return this;
	}

	/**
	 * Build and execute the composed query with error propagation
	 */
	async build(options: ComposableQueryOptions<AppSortMethod> = {}): Promise<ComposableQueryResult<SteamApp>> {
		// Enforce explicit scope: either app IDs or a required-apps subquery must be provided
		// Allow search-only queries (no explicit scope IDs or subquery) when a search term is provided.
		if (this.appIds.size === 0 && this.requiredAppsSubquery === undefined && !this.searchTerm) {
			throw new Error(
				"AppRepository.build(): undefined scope. Provide withAppIds(...) or withRequiredEntitySubquery('apps', ...).",
			);
		}

		// First ensure all required data exists (this may accumulate errors)
		const ensureDataResult = await this.ensureDataExists();
		if (ensureDataResult.error)
			console.warn(`[AppRepository] Failed to ensure all data exists: ${ensureDataResult.error.message}`);

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
	 * Execute a COUNT(*) over the logical result set produced by the current composition.
	 * - Preserves ensure-before-read semantics (runs ensureDataExists first)
	 * - Reuses the same CTEs and where conditions as build()
	 * - Ignores sorting/pagination and hydration; COUNT DISTINCT apps.id only
	 * - Enforces explicit scope guard identical to build()
	 */
	async count(): Promise<Attempt<number, AttemptStatus>> {
		// Enforce explicit scope: either app IDs or a required-apps subquery must be provided
		if (this.appIds.size === 0 && this.requiredAppsSubquery === undefined && !this.searchTerm) {
			throw new Error(
				"AppRepository.build(): undefined scope. Provide withAppIds(...) or withRequiredEntitySubquery('apps', ...) or withSearch(...).",
			);
		}

		// Ensure data first; capture any error but proceed to COUNT
		const ensureRes = await this.ensureDataExists();
		if (ensureRes.error)
			console.warn(`[AppRepository] Failed to ensure all data exists: ${ensureRes.error.message}`);

		// Start base COUNT query
		const lang = getLanguageByCode(this.lang)?.apiCode || "english";

		// If we have CTEs, apply them to the query
		const withCTE = this.ctes.length > 0 ? this.db.with(...this.ctes) : this.db;

		let query = withCTE
			.select({
				cnt: countDistinct(apps.id),
			})
			.from(apps)
			.$dynamic();

		const allConditions = [eq(apps.lang, lang), ...this.whereConditions];
		if (allConditions.length > 0) {
			query = query.where(and(...allConditions));
		}

		const rows = await query;
		const count = rows[0]?.cnt ?? 0;
		return ensureRes.map(() => count);
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
			const appsResult = await this.fetchAndUpsertApps(missingAppIds);
			combinedResult = combinedResult.and(appsResult);
		}

		// Player estimates is still relatively important (in order for player count scores, see above comment)
		getFetchManager().reset({ maxFetches: 150 }); // (150 apps * 1 request per app = 150)

		// Check for missing player estimates
		const missingPlayerIds = await this.findMissingPlayerEstimates();
		if (missingPlayerIds.length > 0) {
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
			// Use provided subquery from cross-repository dependency with notExists; incorporate freshness cutoff if present
			if (this.freshnessCutoff) {
				const missingAppsQuery = this.db
					.select({ app_id: this.requiredAppsSubquery.app_id })
					.from(this.requiredAppsSubquery)
					.where(
						notExists(
							this.db
								.select()
								.from(apps)
								.where(
									and(
										eq(apps.id, this.requiredAppsSubquery.app_id),
										eq(apps.lang, lang),
										gte(apps.updated_at, this.freshnessCutoff),
									),
								),
						),
					);
				const result = await missingAppsQuery;
				return result.map((row) => row.app_id);
			}
			const missingAppsQuery = this.db
				.select({ app_id: this.requiredAppsSubquery.app_id })
				.from(this.requiredAppsSubquery)
				.where(
					notExists(
						this.db
							.select()
							.from(apps)
							.where(and(eq(apps.id, this.requiredAppsSubquery.app_id), eq(apps.lang, lang))),
					),
				);
			const result = await missingAppsQuery;
			return result.map((row) => row.app_id);
		}

		if (this.appIds.size > 0) {
			// Consumer-controlled app IDs - safe to use inArray directly
			const appIdsArray = Array.from(this.appIds);
			let existingAppsQ = this.db
				.selectDistinct({ id: apps.id, updated_at: apps.updated_at })
				.from(apps)
				.where(and(eq(apps.lang, lang), inArray(apps.id, appIdsArray)))
				.$dynamic();

			if (this.freshnessCutoff) {
				existingAppsQ = existingAppsQ.where(gte(apps.updated_at, this.freshnessCutoff));
			}

			const existingApps = await existingAppsQ;

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
			if (this.freshnessCutoff) {
				const missingPlayerEstimatesQuery = this.db
					.select({ app_id: this.requiredAppsSubquery.app_id })
					.from(this.requiredAppsSubquery)
					.where(
						notExists(
							this.db
								.select()
								.from(estimatedPlayers)
								.where(
									and(
										eq(estimatedPlayers.app_id, this.requiredAppsSubquery.app_id),
										gte(estimatedPlayers.updated_at, this.freshnessCutoff),
									),
								),
						),
					);
				const result = await missingPlayerEstimatesQuery;
				return result.map((row) => row.app_id);
			}
			const missingPlayerEstimatesQuery = this.db
				.select({ app_id: this.requiredAppsSubquery.app_id })
				.from(this.requiredAppsSubquery)
				.where(
					notExists(
						this.db
							.select()
							.from(estimatedPlayers)
							.where(eq(estimatedPlayers.app_id, this.requiredAppsSubquery.app_id)),
					),
				);
			const result = await missingPlayerEstimatesQuery;
			return result.map((row) => row.app_id);
		}

		if (this.appIds.size > 0) {
			// Consumer-controlled app IDs - safe to use inArray directly
			const appIdsArray = Array.from(this.appIds);
			let existingPlayerEstimatesQ = this.db
				.selectDistinct({ app_id: estimatedPlayers.app_id, updated_at: estimatedPlayers.updated_at })
				.from(estimatedPlayers)
				.where(inArray(estimatedPlayers.app_id, appIdsArray))
				.$dynamic();
			if (this.freshnessCutoff) {
				existingPlayerEstimatesQ = existingPlayerEstimatesQ.where(
					gte(estimatedPlayers.updated_at, this.freshnessCutoff),
				);
			}
			const existingPlayerEstimates = await existingPlayerEstimatesQ;

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
		// Fetch achievement meta (verbose logging removed)
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
		// English meta presence: ${existingEnglishMeta.length}

		if (hasEnglishInDb) {
			// We have English in DB, only fetch the requested language
			const requestedRes = await this.steamApi.getSchemaForGame({
				appid: appId,
				l: requestedLang,
			});
			const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];

			// Requested achievements count (English cached)

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
			// 2. If identical (same display_name, description), store BOTH versions with same content for SQL COALESCE compatibility
			// 3. [lang] app record is still created (for re-fetch prevention)
			// 4. SQL COALESCE in achievement queries will handle fallback automatically
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

			// Achievements identical? ${areIdentical}
			if (!areIdentical) {
				// Show first few differences for debugging
				let diffCount = 0;
				for (const req of requestedMapped) {
					if (diffCount >= 3) break;

					const eng = englishMap.get(req.ach_id);
					if (!eng) {
						// diff: requested only
						diffCount++;
					} else {
						const nameMatch = req.display_name === eng.display_name;
						const descMatch = req.description === eng.description;
						if (!nameMatch || !descMatch) {
							// diff: text mismatch
							diffCount++;
						}
					}
				}
				// Check for English achievements missing in requested language
				for (const eng of englishMapped) {
					if (diffCount >= 3) break;
					if (!requestedMap.has(eng.ach_id)) {
						// diff: english only
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
				// identical: treat as no translation exists, don't store requested language
				result = {
					requested: [], // Don't store duplicate content
					english: englishMapped,
					wasEnglishFromDb: true,
				};
			} else {
				// differ: store both versions
				result = {
					requested: requestedMapped,
					english: englishMapped,
					wasEnglishFromDb: true,
				};
			}

			// fallback summary stored (English from DB)
			return result;
		}

		// We don't have English in DB, fetch both requested language and English
		const [requestedRes, englishRes] = await Promise.all([
			this.steamApi.getSchemaForGame({ appid: appId, l: requestedLang }),
			this.steamApi.getSchemaForGame({ appid: appId, l: "english" }),
		]);

		const requestedAchievements = requestedRes?.game?.availableGameStats?.achievements || [];
		const englishAchievements = englishRes?.game?.availableGameStats?.achievements || [];

		// Requested & English achievements counts fetched

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
		// 2. If identical, store BOTH versions with same content for SQL COALESCE compatibility
		// 3. French app record is still created (prevents re-fetching)
		// 4. SQL COALESCE in achievement queries will handle fallback automatically
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

		// Achievement equivalence computed

		let result: {
			requested: typeof requestedMapped;
			english: typeof englishMapped;
			wasEnglishFromDb: boolean;
		};
		if (areIdentical) {
			// identical: treat as no translation exists, don't store requested language
			result = {
				requested: [], // Don't store duplicate content
				english: englishMapped,
				wasEnglishFromDb: false,
			};
		} else {
			// differ: storing both versions
			result = {
				requested: requestedMapped,
				english: englishMapped,
				wasEnglishFromDb: false,
			};
		}

		// fallback summary stored
		return result;
	}

	/**
	 * Fetch and upsert comprehensive app data including achievements metadata and stats.
	 * When unlockedAtMode is enabled, avoid flatten-then-insert accumulation:
	 * - Process appIds sequentially (FIFO 1), keep per-app Promise.all for subresources.
	 * - After each app fetch, map records and safeInsert immediately in small batches.
	 * - Yield between per-app inserts to allow the global fetch limiter to interleave work.
	 * This keeps memory bounded and reduces burstiness across all insert paths.
	 */
	private async fetchAndUpsertApps(appIds: number[]): Promise<Attempt<undefined, AttemptStatus>> {
		if (appIds.length === 0) return Attempt.ok(undefined);

		console.debug(`[AppRepository] Requesting ${appIds.length} entries`);

		const lang = getLanguageByCode(this.lang)?.apiCode || "english";

		// App data fetch helper (per app)
		const fetchAppData = async (id: number) => {
			const [appDetails, achievementMeta, achievementStats] = await Promise.all([
				this.steamStoreApi.getAppDetails(id, { l: lang }).then((res) => Object.values(res)[0]?.data || null),
				this.fetchAchievementMetaWithFallbackDetection(id, lang),
				this.steamApi.getGlobalAchievementPercentagesForApp({ gameid: id }).then((statsResponse) => {
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

		if (!this.unlockedAtMode) {
			// Fetch missing apps (comprehensive)
			const attempt = await Attempt.all(appIds.map((id) => fetchAppData(id)));

			const validData = attempt.data.filter(
				(d) => d !== undefined && d.achievementStats !== undefined && d.achievementMeta !== undefined,
			);

			if (validData.length > 0) {
				const appData = validData
					.filter((data) => data !== undefined)
					.map((data) => ({
						lang: lang,
						id: data.appId,
						data: data.appDetails,
					}));

				console.debug(`[AppRepository] Upsert ${validData.length} entries`);

				const achievementStatsData = validData
					.flatMap((data) => data?.achievementStats)
					.filter((s) => s !== undefined);
				const achievementMetaData = validData
					.flatMap((data) => {
						const results: Array<{
							app_id: number;
							ach_id: string;
							display_name: string;
							default_value: number;
							description?: string;
							icon: string;
							icon_gray: string;
							hidden: number;
							lang: APILanguageCode;
						}> = [];
						const meta = data?.achievementMeta;
						if (!meta || meta === null) return [];

						// Requested language
						results.push(
							...meta.requested.map((m) => ({
								...m,
								lang,
							})),
						);

						// Also English if applicable (always store English when available)
						if (lang !== "english" && meta.english) {
							results.push(
								...meta.english.map((m) => ({
									...m,
									lang: "english" as const,
								})),
							);
						}
						return results;
					})
					.filter((m) => m !== undefined);

				await safeInsert(this.db, appData, (chunk) =>
					this.db
						.insert(apps)
						.values(chunk)
						.onConflictDoUpdate({
							target: [apps.id, apps.lang],
							set: { data: excluded(apps.data), updated_at: new Date() },
						}),
				);
				await safeInsert(this.db, achievementStatsData, (chunk) =>
					this.db
						.insert(achievementsStats)
						.values(chunk)
						.onConflictDoUpdate({
							target: [achievementsStats.app_id, achievementsStats.ach_id],
							set: { percent: excluded(achievementsStats.percent), updated_at: new Date() },
						}),
				);
				await safeInsert(this.db, achievementMetaData, (chunk) =>
					this.db
						.insert(achievementsMeta)
						.values(chunk)
						.onConflictDoUpdate({
							target: [achievementsMeta.app_id, achievementsMeta.ach_id, achievementsMeta.lang],
							set: {
								display_name: excluded(achievementsMeta.display_name),
								default_value: excluded(achievementsMeta.default_value),
								description: excluded(achievementsMeta.description),
								icon: excluded(achievementsMeta.icon),
								icon_gray: excluded(achievementsMeta.icon_gray),
								hidden: excluded(achievementsMeta.hidden),
							},
						}),
				);
			}

			// Ensure any upstream API error is surfaced to the caller
			return Attempt.from(undefined, attempt.error ?? null);
		}

		// Streaming micro-batch variant for unlockedAtMode
		// Capture Steam client errors via Attempt.try; allow DB errors to propagate.
		let firstError: Error | null = null;

		for (const id of appIds) {
			// Fetch remote data with error capture
			// fetchAppData may reject on API errors (e.g., rate limiting); capture as Partial and continue
			const dataAttempt = await Attempt.try(() => fetchAppData(id));
			if (dataAttempt.error || dataAttempt.data == null) {
				if (!firstError && dataAttempt.error) firstError = dataAttempt.error;
				// Skip inserts for this app and continue
				await Promise.resolve();
				continue;
			}
			const data = dataAttempt.data;

			// app record (DB operations must be allowed to throw)
			const appData = [
				{
					lang,
					id: data.appId,
					data: data.appDetails,
				},
			];
			await safeInsert(this.db, appData, (chunk) =>
				this.db
					.insert(apps)
					.values(chunk)
					.onConflictDoUpdate({
						target: [apps.id, apps.lang],
						set: { data: excluded(apps.data), updated_at: new Date() },
					}),
			);

			// stats (language-agnostic)
			const stats = (data.achievementStats || []).filter((s) => s !== undefined);
			if (stats.length > 0) {
				await safeInsert(this.db, stats, (chunk) =>
					this.db
						.insert(achievementsStats)
						.values(chunk)
						.onConflictDoUpdate({
							target: [achievementsStats.app_id, achievementsStats.ach_id],
							set: { percent: excluded(achievementsStats.percent), updated_at: new Date() },
						}),
				);
			}

			// meta
			const metas: Array<{
				app_id: number;
				ach_id: string;
				display_name: string;
				default_value: number;
				description?: string;
				icon: string;
				icon_gray: string;
				hidden: number;
				lang: APILanguageCode;
			}> = [];
			const meta = data.achievementMeta;
			if (meta && meta !== null) {
				metas.push(
					...meta.requested.map((m) => ({
						...m,
						lang,
					})),
				);
				if (lang !== "english" && meta.english) {
					metas.push(
						...meta.english.map((m) => ({
							...m,
							lang: "english" as const,
						})),
					);
				}
			}
			if (metas.length > 0) {
				await safeInsert(this.db, metas, (chunk) =>
					this.db
						.insert(achievementsMeta)
						.values(chunk)
						.onConflictDoUpdate({
							target: [achievementsMeta.app_id, achievementsMeta.ach_id, achievementsMeta.lang],
							set: {
								display_name: excluded(achievementsMeta.display_name),
								default_value: excluded(achievementsMeta.default_value),
								description: excluded(achievementsMeta.description),
								icon: excluded(achievementsMeta.icon),
								icon_gray: excluded(achievementsMeta.icon_gray),
								hidden: excluded(achievementsMeta.hidden),
							},
						}),
				);
			}

			// Yield between apps so the global fetch limiter can schedule other work
			await Promise.resolve();
		}

		return Attempt.from(undefined, firstError);
	}

	/**
	 * Fetch and cache SteamCharts data for an app.
	 */
	private async fetchAndCacheSteamChartsSnapshot(appId: number): Promise<SteamChartsSnapshot | null> {
		const chartData = await this.steamChartsApi.getAppChartData(appId);
		if (chartData === null) return null;

		const snapshot = summarizeSteamChartsData(chartData);
		if (snapshot === null) return null;

		await this.db
			.insert(steamChartsSnapshots)
			.values({
				app_id: appId,
				all_time_peak: snapshot.allTimePeak,
				avg_count: snapshot.avgCount,
				day_peak: snapshot.dayPeak,
				recent_points: snapshot.recentPoints,
				updated_at: new Date(),
			})
			.onConflictDoUpdate({
				target: steamChartsSnapshots.app_id,
				set: {
					all_time_peak: excluded(steamChartsSnapshots.all_time_peak),
					avg_count: excluded(steamChartsSnapshots.avg_count),
					day_peak: excluded(steamChartsSnapshots.day_peak),
					recent_points: excluded(steamChartsSnapshots.recent_points),
					updated_at: new Date(),
				},
			});

		return snapshot;
	}

	/**
	 * Fetch and upsert player count estimates with full calculation.
	 */
	private async fetchAndUpsertPlayerEstimates(appIds: number[]): Promise<Attempt<undefined, AttemptStatus>> {
		if (appIds.length === 0) return Attempt.ok(undefined);

		console.debug(`[AppRepository] Requesting ${appIds.length} entries`);

		const lang = getLanguageByCode(this.lang)?.apiCode || "english";
		let appDetailsRows: Array<{ id: number; data: unknown }>;

		if (this.requiredAppsSubquery) {
			const estimateExistsQuery = this.db
				.select({ app_id: estimatedPlayers.app_id })
				.from(estimatedPlayers)
				.where(
					this.freshnessCutoff
						? and(
								eq(estimatedPlayers.app_id, this.requiredAppsSubquery.app_id),
								gte(estimatedPlayers.updated_at, this.freshnessCutoff),
							)
						: eq(estimatedPlayers.app_id, this.requiredAppsSubquery.app_id),
				);

			appDetailsRows = await this.db
				.select({
					id: apps.id,
					data: apps.data,
				})
				.from(this.requiredAppsSubquery)
				.innerJoin(apps, eq(this.requiredAppsSubquery.app_id, apps.id))
				.where(and(eq(apps.lang, lang), notExists(estimateExistsQuery)));
		} else {
			const appIdConditions = appIds.map((appId) => eq(apps.id, appId));
			const appIdsCondition = or(...appIdConditions);
			if (appIdsCondition === undefined) return Attempt.ok(undefined);

			const allConditions = [eq(apps.lang, lang), ...this.whereConditions, appIdsCondition];
			appDetailsRows = await this.db
				.select({
					id: apps.id,
					data: apps.data,
				})
				.from(apps)
				.where(and(...allConditions));
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
				return Attempt.ok({
					app_id: appId,
					estimated_players: null,
				});
			}

			getFetchManager().reset({ maxFetches: 200 });
			const playerCountData = await Attempt.all([
				this.steamStoreApi.getAppReviews(appId, { num_per_page: "0" }),
				this.fetchAndCacheSteamChartsSnapshot(appId),
			]);

			const playerCount = await playerCountData.chainAsync(async (data) => {
				const [appReviews, appPlayerCount] = data;

				if (appPlayerCount === undefined) {
					return Attempt.ok(null);
				}

				if (appReviews == null) {
					return Attempt.partial<number>(0, new Error(`Missing review or chart data for app ${appId}`));
				}

				if (appPlayerCount === null) return Attempt.ok(null);

				const reviews = appReviews as NonNullable<typeof appReviews>;

				const estimate = await estimatePlayerCount({
					all_time_peak: appPlayerCount.allTimePeak,
					avg_count: appPlayerCount.avgCount,
					day_peak: appPlayerCount.dayPeak,
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

		if (filteredData.length > 0) {
			console.debug(`[AppRepository] Upsert ${filteredData.length} entries`);
			await safeInsert(this.db, filteredData, (chunk) =>
				this.db
					.insert(estimatedPlayers)
					.values(chunk)
					.onConflictDoUpdate({
						target: estimatedPlayers.app_id,
						set: {
							estimated_players: excluded(estimatedPlayers.estimated_players),
							updated_at: new Date(),
						},
					}),
			);
		}

		const firstError = playerCountData.find((d) => d.isError());
		return Attempt.from(undefined, firstError ? firstError.error : null);
	}
}

export class AppRepository implements Repository<SteamApp, AppSortMethod> {
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

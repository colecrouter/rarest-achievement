import {
	and,
	asc,
	countDistinct,
	desc,
	eq,
	exists,
	inArray,
	isNotNull,
	isNull,
	lt,
	max,
	or,
	type SQL,
} from "drizzle-orm";
import type { SubqueryWithSelection, WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import {
	achievementsStats,
	apps,
	estimatedPlayers,
	friends,
	getLanguageByCode,
	ownedGames,
	type ProjectDB,
	userAchievements,
} from "../..";
import { Attempt, type AttemptStatus } from "../../error";
import type { APILanguageCode } from "../../lang";
import { SteamApp, type SteamAppAchievement, type SteamFriendUser, SteamUserAchievement } from "../../models";
import type { SteamAppRaw } from "../../models/SteamApp";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import {
	type ComposableQueryOptions,
	ComposableQueryResult,
	type ComposableRepository,
	createQueryResult,
	type RequiredSubquery,
} from "../composable";
import { getFetchManager } from "../fetchManager";
import type { Repository } from "../repository";
import type { AppRepository } from "./App";
import type { AppAchievementRepository } from "./AppAchievement";
import { BaseAchievementQueryComposer } from "./BaseAchievement";
import type { EnsurePolicy } from "./ensurePolicy";
import { defaultEnsurePolicy, defaultUnlockedAtEnsurePolicy } from "./ensurePolicy";
import type { FriendsRepository } from "./Friends";
import { caseWhen, concat, excluded } from "./operators";
import { achievementsMeta } from "./schema";
import type { UserRepository } from "./User";
import { safeInsert } from "./utils";

/**
 * UserAchievement Repository - Pure SQL Composition Architecture
 *
 * This repository has been completely rewritten to solve the "parameter explosion" problem
 * that was causing SQL query failures when trying to pass large arrays via `inArray()`.
 *
 * ## Key Design Principles:
 *
 * 1. **Pure SQL Composition**: All filtering is done via declarative SQL JOINs and WHERE
 *    clauses, eliminating the need to pass result arrays between queries.
 *
 * 2. **Parameter Safety**: Only top-level user input (appIds, userIds, achIds) are passed
 *    as direct parameters. All derived filters use JOINs or subqueries.
 *
 * 3. **Two Processing Modes**:
 *    - **Direct Mode**: Simple query with minimal JOINs for basic filtering
 *    - **Comprehensive Mode**: Single comprehensive SQL query with all metadata JOINs
 *
 * ## How Parameter Explosion is Avoided:
 *
 * ### Before (Problematic):
 * ```typescript
 * const achievements = await query.where(inArray(apps.id, ownedGameIds)); // 💥 FAILS
 * const friendAchievements = await query.where(inArray(userAchievements.user_id, friendIds)); // 💥 FAILS
 * ```
 *
 * ### After (Fixed):
 * ```typescript
 * const achievements = await db
 *   .select()
 *   .from(userAchievements)
 *   .innerJoin(ownedGames, eq(userAchievements.app_id, ownedGames.app_id)) // All owned games
 *   .innerJoin(friends, eq(friends.friend_id, userAchievements.user_id))   // All friends
 *   .where(eq(friends.user_id, userId)); // ✅ WORKS
 * ```
 */

export type UserAchievementSortMethod = "rarity_pct" | "rarity_score" | "unlocked_at";

// Legacy filter param interfaces removed: composable query API supersedes generic filter typing

/**
 * Composable query builder for user achievements
 * Uses SQL composition with JOINs to avoid parameter explosion
 */
class UserAchievementQueryComposer extends BaseAchievementQueryComposer<
	SteamUserAchievement,
	UserAchievementSortMethod
> {
	private userIds: Set<string> = new Set();
	private friendsOfUserId?: string;
	private unlockedFilter?: boolean;
	private ensurePolicy: EnsurePolicy = defaultEnsurePolicy();

	constructor(
		db: ProjectDB,
		private steamApi: SteamAuthenticatedAPIClient,
		private appAchievementRepository: AppAchievementRepository,
		private userRepository: UserRepository,
		private friendsRepository: FriendsRepository,
		private appRepository: AppRepository,
	) {
		super(db);
	}

	/**
	 * Create inArray condition for app IDs using userAchievements table
	 */
	protected createAppIdsCondition(appIds: number[]): SQL {
		return inArray(userAchievements.app_id, appIds);
	}

	/**
	 * Create inArray condition for achievement IDs using userAchievements table
	 */
	protected createAchievementIdsCondition(achIds: string[]): SQL {
		return inArray(userAchievements.ach_id, achIds);
	}

	/**
	 * Apply sorting to a query based on the sort options
	 * Handles UserAchievement-specific sorting patterns (rarity_pct, rarity_score, unlocked_at)
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Generic query type from Drizzle
	private applySorting(query: any, options: ComposableQueryOptions<UserAchievementSortMethod>): any {
		if (!options.sort) return query;

		if (options.sort.method === "unlocked_at") {
			const dir = options.sort.direction === "desc" ? desc : asc;
			return query.orderBy(
				asc(caseWhen().when(isNull(userAchievements.unlocked_at), 1).else(0).endNonNull()),
				dir(userAchievements.unlocked_at),
			);
		}

		// Delegate rarity sorts to base helper
		const { orderBy } = this.buildRaritySortPieces(
			options.sort,
			achievementsStats.percent,
			estimatedPlayers.estimated_players,
		);
		if (orderBy.length > 0) return query.orderBy(...orderBy);
		return query;
	}

	/**
	 * Filter by specific user IDs
	 */
	withUserIds(userIds: string | Iterable<string>): this {
		if (typeof userIds === "string") {
			this.userIds.add(userIds);
		} else {
			for (const id of userIds) {
				this.userIds.add(id);
			}
		}
		return this;
	}

	/**
	 * Filter by friends of a specific user
	 */
	withFriendsOf(userId: string): this {
		this.friendsOfUserId = userId;
		return this;
	}

	/**
	 * Filter by unlocked status
	 */
	withUnlockedStatus(unlocked?: boolean): this {
		this.unlockedFilter = unlocked;
		// Add WHERE condition for unlocked status
		if (unlocked !== undefined) {
			this.whereConditions.push(
				unlocked ? isNotNull(userAchievements.unlocked_at) : isNull(userAchievements.unlocked_at),
			);
		}
		return this;
	}

	/** Provide a freshness cutoff so dependent repositories can treat stale rows as missing */
	withCutoff(cutoff: Date): this {
		this.freshnessCutoff = cutoff;
		return this;
	}

	/**
	 * Override base hook: derive required app scope from ownedGames (user context) instead of achievementsStats.
	 */
	protected buildRequiredAppsScope(): RequiredSubquery | undefined {
		let neededAppsQuery = this.db.selectDistinct({ app_id: ownedGames.app_id }).from(ownedGames).$dynamic();

		// User / friends scoping
		if (this.friendsOfUserId) {
			neededAppsQuery = neededAppsQuery
				.innerJoin(friends, eq(friends.friend_id, ownedGames.user_id))
				.where(eq(friends.user_id, this.friendsOfUserId));
		} else if (this.userIds.size > 0) {
			neededAppsQuery = neededAppsQuery.where(inArray(ownedGames.user_id, Array.from(this.userIds)));
		} else {
			return undefined; // No user scope => no derivable app scope
		}

		// Optional explicit app narrowing
		if (this.appIds.size > 0) {
			neededAppsQuery = neededAppsQuery.where(inArray(ownedGames.app_id, Array.from(this.appIds)));
		}

		return neededAppsQuery.as("required_apps");
	}

	/** Provide a required user subquery selecting { id } */
	withRequiredUser(
		sub: WithSubqueryWithSelection<{ id: unknown }, string> | SubqueryWithSelection<{ id: unknown }, string>,
	): this {
		// Validate presence of id column structurally; no 'any' usage
		this.whereConditions.push(exists(this.db.select().from(sub).where(eq(sub.id, userAchievements.user_id))));
		return this;
	}

	/**
	 * Get candidate app_ids from owned_games for a user ordered by last_played_at DESC.
	 * Recommendation: add an index on (user_id, last_played_at DESC) in a separate migration for performance.
	 */
	private async getCandidateAppsFromOwnedGames(userId: string, window: number): Promise<number[]> {
		const rows = await this.db
			.select({ app_id: ownedGames.app_id })
			.from(ownedGames)
			.where(eq(ownedGames.user_id, userId))
			.orderBy(desc(ownedGames.last_played_at), asc(ownedGames.app_id))
			.limit(window);
		return rows.map((r) => r.app_id);
	}

	/**
	 * Aggregate across multiple users: pick distinct app_ids ordered by max(last_played_at)
	 * across the provided users. Bounded by window to keep the candidate set small.
	 */
	private async getCandidateAppsFromOwnedGamesForUsers(userIds: string[], window: number): Promise<number[]> {
		if (userIds.length === 0) return [];
		const last = max(ownedGames.last_played_at).as("last");
		const rows = await this.db
			.select({
				app_id: ownedGames.app_id,
				last,
			})
			.from(ownedGames)
			.where(inArray(ownedGames.user_id, userIds))
			.groupBy(ownedGames.app_id)
			.orderBy(desc(last), asc(ownedGames.app_id))
			.limit(window);
		return rows.map((r) => r.app_id);
	}

	/**
	 * Build and execute the composed query
	 */
	async build(
		options: ComposableQueryOptions<UserAchievementSortMethod> = {},
	): Promise<ComposableQueryResult<SteamUserAchievement>> {
		// Check if we have any user filtering criteria
		if (this.userIds.size === 0 && !this.friendsOfUserId) {
			return createQueryResult([], options.cursor || 0);
		}

		// Unified ensure path (captures dependency ensure across users/apps/achievements)
		const ensureAttempt = await this.ensureUserDataExists();
		if (ensureAttempt.error)
			console.warn(
				`[UserAchievementRepository] Failed to ensure all data exists: ${ensureAttempt.error.message}`,
			);

		// Determine processing mode based on filters or unlocked_at policy
		let resultsAttempt: Attempt<SteamUserAchievement[], AttemptStatus>;
		if (options.sort && options.sort.method === "unlocked_at" && this.searchTerm === undefined) {
			// Attach EnsurePolicy automatically for unlocked_at; direct-first + scoped ensure
			this.ensurePolicy = defaultUnlockedAtEnsurePolicy();
			resultsAttempt = await this.executeUnlockedAtScopedFlow(options);
		} else {
			const shouldUseComprehensiveSQL = this.shouldUseComprehensiveSQL();
			resultsAttempt = await (shouldUseComprehensiveSQL
				? this.executeWithComprehensiveSQL(options)
				: this.executeDirectQuery(options));
		}

		if (options.sort?.method === "rarity_score" && resultsAttempt.hasData() && resultsAttempt.data.length === 0) {
			const fallbackOptions: ComposableQueryOptions<UserAchievementSortMethod> = {
				...options,
				sort: { method: "rarity_pct", direction: "asc" },
			};
			const shouldUseComprehensiveSQL = this.shouldUseComprehensiveSQL();
			const fallbackAttempt = await (shouldUseComprehensiveSQL
				? this.executeWithComprehensiveSQL(fallbackOptions)
				: this.executeDirectQuery(fallbackOptions));
			if (fallbackAttempt.hasData() && fallbackAttempt.data.length > 0) {
				resultsAttempt = Attempt.from(fallbackAttempt.data, resultsAttempt.error ?? fallbackAttempt.error);
			}
		}

		// If we got no results but the caller requested a specific app (e.g. viewing a single game page),
		// fall back to returning the global AppAchievement list for that app with userStats=null so logged-in
		// non-owners still see the app's achievements (mirrors anonymous behavior).
		//
		// Fallback semantics:
		// - Trigger: results are empty AND the composition narrowed by explicit appIds.
		// - Action: fetch app achievements via AppAchievementRepository and map to SteamUserAchievement with
		//   userStats=null (unlocked=null). This allows the UI to render achievements even when the user/friend
		//   does not have an owned_games row for the app.
		// - Primary user: if a specific userId or friendsOf(userId) was provided, we attempt to attach that
		//   user object (profile only) to the returned items; otherwise user may be undefined. This does not
		//   imply ownership or unlocks.
		//
		// Why this matters:
		// - Strict JOINs against owned_games are intentional to avoid parameter explosion and to respect
		//   ownership semantics. However, in real deployments partial/stale data can temporarily omit an
		//   owned_games row (e.g., friends fetched without their library). The fallback ensures the page remains
		//   useful instead of appearing blank.
		// - When a freshness cutoff is supplied upstream (withCutoff), the ensure layer should re-fetch the
		//   missing friend profile + owned games, at which point the direct JOIN path yields proper results and
		//   this fallback typically will not execute.
		if (resultsAttempt.hasData() && resultsAttempt.data.length === 0 && this.appIds.size > 0) {
			const appIds = Array.from(this.appIds);
			// Fetch app achievements
			const appAchComposer = this.appAchievementRepository.compose().withLanguage(this.lang).withAppIds(appIds);
			// AppAchievement composer no longer exposes withCutoff; freshness only applied at ensure layer.
			const appAchResult = await appAchComposer.build();

			const finalData: SteamUserAchievement[] = [];
			if (appAchResult.hasData()) {
				// Determine a primary user to attach (if available). Prefer explicit userIds, otherwise use friendsOfUserId.
				let primaryUserId: string | undefined;
				if (this.userIds.size > 0) primaryUserId = Array.from(this.userIds)[0];
				else if (this.friendsOfUserId) primaryUserId = this.friendsOfUserId;

				// Fetch user object if we have an ID to attach
				let userObj = null;
				if (primaryUserId) {
					const userComposer = this.userRepository.compose().withUserIds([primaryUserId]);
					if (this.freshnessCutoff) userComposer.withCutoff(this.freshnessCutoff);
					const userRes = await userComposer.build();
					if (userRes.hasData() && userRes.data.length > 0) {
						userObj = userRes.data[0];
					}
				}

				for (const appAch of appAchResult.data) {
					// Build a SteamUserAchievement with userStats=null (user hasn't unlocked anything)
					finalData.push(
						new SteamUserAchievement({
							app: appAch.app,
							meta: appAch.serialize().meta,
							globalStats: appAch.serialize().globalStats,
							lang: appAch.serialize().lang,
							user: userObj ?? undefined,
							userStats: null,
						}),
					);
				}
			}

			const combinedError = resultsAttempt.error || (appAchResult?.error ?? null);
			return createQueryResult(finalData, (options.cursor || 0) + finalData.length, combinedError);
		}

		const combinedError = resultsAttempt.error || ensureAttempt.error || null;
		return createQueryResult(
			resultsAttempt.hasData() ? resultsAttempt.data : [],
			(options.cursor || 0) + (resultsAttempt.hasData() ? resultsAttempt.data.length : 0),
			combinedError,
		);
	}
	/**
	 * COUNT-only execution path matching current filters.
	 * Preserves dual-storage semantics by ensuring data exists prior to counting.
	 * Reuses identical CTEs and WHERE stack as build(), but avoids ORDER BY/LIMIT and wide selects.
	 */
	async count(): Promise<Attempt<number, AttemptStatus>> {
		// Ensure we have a user scope; otherwise nothing to count
		if (this.userIds.size === 0 && !this.friendsOfUserId) {
			return Attempt.ok(0);
		}

		// Consolidated ensure path
		const ensureResult = await this.ensureUserDataExists();
		if (ensureResult.error)
			console.warn(`[UserAchievementRepository] Failed to ensure all data exists: ${ensureResult.error.message}`);

		// Build user filter conditions (same as build paths)
		const userFilterConditions = [];
		if (!this.friendsOfUserId && this.userIds.size > 0) {
			const userIdsArray = Array.from(this.userIds) as string[];
			userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
		}

		const useComprehensive = this.shouldUseComprehensiveSQL();
		const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

		// Build COUNT query with identical joins/filters; avoid ORDER BY/LIMIT and hydration
		let query = this.db
			.with(...this.ctes)
			.select({
				count: countDistinct(
					concat(userAchievements.user_id, ":", userAchievements.app_id, ":", userAchievements.ach_id),
				),
			})
			.from(userAchievements)
			// Enforce "owned" semantics identical to build()
			.innerJoin(
				ownedGames,
				and(eq(userAchievements.user_id, ownedGames.user_id), eq(userAchievements.app_id, ownedGames.app_id)),
			)
			// Provide achievementsStats so rarity/search CTE EXISTS correlate to these columns (same as build)
			.leftJoin(
				achievementsStats,
				and(
					eq(userAchievements.app_id, achievementsStats.app_id),
					eq(userAchievements.ach_id, achievementsStats.ach_id),
				),
			)
			.$dynamic();

		if (useComprehensive) {
			// Join achievements_meta with language fallback logic (keeps identical semantics to build)
			query = query
				.innerJoin(
					achievementsMeta,
					and(
						eq(userAchievements.app_id, achievementsMeta.app_id),
						eq(userAchievements.ach_id, achievementsMeta.ach_id),
						super.createLanguageFallbackCondition(
							userAchievements.app_id,
							userAchievements.ach_id,
							apiCode,
						),
					),
				)
				// Join apps to mirror the comprehensive build composition
				.innerJoin(apps, and(eq(userAchievements.app_id, apps.id), eq(apps.lang, apiCode)));
		}

		// Friends-of filter via JOIN (same as build() paths)
		if (this.friendsOfUserId) {
			const friendsOf = this.friendsOfUserId as string;
			query = query.innerJoin(
				friends,
				and(eq(friends.friend_id, userAchievements.user_id), eq(friends.user_id, friendsOf)),
			);
		}

		// Collect all standard and extra conditions (appIds, achIds, unlocked, rarity/search CTE EXISTS, etc.)
		const allConditions = this.collectWhereConditions(...userFilterConditions);
		if (allConditions.length > 0) {
			query = query.where(and(...allConditions));
		}

		const rows = await query;
		const count = rows[0]?.count ?? 0;
		return ensureResult.map(() => count);
	}

	/**
	 * Determine if we should use the comprehensive SQL approach
	 * Use comprehensive SQL when:
	 * 1. Filtering by unlocked status (more complex filtering)
	 * 2. Using search functionality (needs achievement metadata)
	 * 3. No explicit app IDs provided (would need "all owned games" logic)
	 * 4. Filtering by rarity threshold (needs rarity data)
	 */
	private shouldUseComprehensiveSQL(): boolean {
		return (
			this.unlockedFilter !== undefined ||
			this.searchTerm !== undefined ||
			this.appIds.size === 0 ||
			this.rarityThreshold !== undefined
		);
	}

	/**
	 * Execute using direct SQL query (for simple cases)
	 */
	private async executeDirectQuery(
		options: ComposableQueryOptions<UserAchievementSortMethod>,
	): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
		// Direct query path (simple filters, minimal joins)

		// Step 1: Determine actual user filtering approach
		const userFilterConditions: SQL[] = [];

		let ensureResult: Attempt<void, AttemptStatus>;
		if (this.friendsOfUserId) {
			// Use JOIN with friends table instead of fetching friend IDs (avoids parameter explosion)
			// But we still need to ensure the friends' data exists in the database
			ensureResult = await this.ensureUserDataExists();
			// The actual user filtering will be handled in the main query JOIN below
		} else if (this.userIds.size > 0) {
			// Direct user IDs are safe as they're top-level parameters
			ensureResult = await this.ensureUserDataExists();
			const userIdsArray = this.userIds.values().toArray();
			userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
		} else {
			// No user scope provided
			return Attempt.ok([]);
		}

		// Step 2: Build and execute the main SQL query using Drizzle's proper JOIN syntax
		let query = this.db
			.with(...this.ctes)
			.select({
				user_id: userAchievements.user_id,
				app_id: userAchievements.app_id,
				ach_id: userAchievements.ach_id,
				unlocked_at: userAchievements.unlocked_at,
				rarity_pct: achievementsStats.percent,
			})
			.from(userAchievements)
			// JOIN to ensure user owns the game (avoids parameter explosion)
			.innerJoin(
				ownedGames,
				and(eq(userAchievements.user_id, ownedGames.user_id), eq(userAchievements.app_id, ownedGames.app_id)),
			)
			// LEFT JOIN for rarity data
			.leftJoin(
				achievementsStats,
				and(
					eq(userAchievements.app_id, achievementsStats.app_id),
					eq(userAchievements.ach_id, achievementsStats.ach_id),
				),
			)
			// LEFT JOIN for estimated players (for rarity score calculation)
			.leftJoin(estimatedPlayers, eq(userAchievements.app_id, estimatedPlayers.app_id))
			.$dynamic();

		// Apply user filter and rarity/search filters collected via base helpers
		const sortPieces = this.buildRaritySortPieces(
			options.sort,
			achievementsStats.percent,
			estimatedPlayers.estimated_players,
		);
		const allConditions = this.collectWhereConditions(...userFilterConditions, ...sortPieces.where);

		if (allConditions.length > 0) {
			query = query.where(and(...allConditions));
		}

		// Apply friends filter using JOIN (avoids parameter explosion)
		if (this.friendsOfUserId) {
			query = query.innerJoin(
				friends,
				and(eq(friends.friend_id, userAchievements.user_id), eq(friends.user_id, this.friendsOfUserId)),
			);
		}

		// Apply sorting
		query = this.applySorting(query, options);

		// Apply pagination
		if (options.limit) {
			query = query.limit(options.limit);
		}

		if (options.cursor) {
			query = query.offset(options.cursor);
		}

		const userAchievementRows = await query;

		// Step 3: Build final results
		const buildResult = await this.buildResultsFromRows(userAchievementRows);
		return ensureResult.and(buildResult);
	}

	/**
	 * Execute unlocked_at direct-first + scoped ensure flow.
	 *
	 * Why: When sorting by unlocked_at, the page often needs only a handful of apps immediately.
	 * We run a DB-limited select first to render quickly, then we ensure only the likely-needed apps.
	 * Candidate apps are sourced from owned_games ordered by last_played_at DESC (recently played first).
	 *
	 * Caps and streaming:
	 * - Ensuring is bounded by EnsurePolicy.caps (apps/time) and streams rows in micro-batches
	 *   via ensureUserAchievementDataExists(policy, orderedCandidates).
	 * - Micro-batching yields between flushes to keep the fetch limiter responsive.
	 * - Partial backfill is allowed; never throw due to caps/time budget.
	 */
	private async executeUnlockedAtScopedFlow(
		options: ComposableQueryOptions<UserAchievementSortMethod>,
	): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
		const policy = this.ensurePolicy?.mode === "unlocked_at" ? this.ensurePolicy : defaultUnlockedAtEnsurePolicy();

		// Build direct query WITHOUT ensuring first (prefer direct-first render)
		const userFilterConditions: SQL[] = [];
		if (this.friendsOfUserId) {
			// Join will be applied below
		} else if (this.userIds.size > 0) {
			const userIdsArray = Array.from(this.userIds);
			userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
		} else {
			return Attempt.ok([]);
		}

		let query = this.db
			.with(...this.ctes)
			.select({
				user_id: userAchievements.user_id,
				app_id: userAchievements.app_id,
				ach_id: userAchievements.ach_id,
				unlocked_at: userAchievements.unlocked_at,
				rarity_pct: achievementsStats.percent,
			})
			.from(userAchievements)
			.innerJoin(
				ownedGames,
				and(eq(userAchievements.user_id, ownedGames.user_id), eq(userAchievements.app_id, ownedGames.app_id)),
			)
			.leftJoin(
				achievementsStats,
				and(
					eq(userAchievements.app_id, achievementsStats.app_id),
					eq(userAchievements.ach_id, achievementsStats.ach_id),
				),
			)
			.leftJoin(estimatedPlayers, eq(userAchievements.app_id, estimatedPlayers.app_id))
			.$dynamic();

		const sortPieces = this.buildRaritySortPieces(
			options.sort,
			achievementsStats.percent,
			estimatedPlayers.estimated_players,
		);
		const allConditions = this.collectWhereConditions(...userFilterConditions, ...sortPieces.where);
		if (allConditions.length > 0) {
			query = query.where(and(...allConditions));
		}

		if (this.friendsOfUserId) {
			query = query.innerJoin(
				friends,
				and(eq(friends.friend_id, userAchievements.user_id), eq(friends.user_id, this.friendsOfUserId)),
			);
		}

		query = this.applySorting(query, options);
		if (options.limit) query = query.limit(options.limit);
		if (options.cursor) query = query.offset(options.cursor);

		const pageRows = await query;

		// Build results from the current DB snapshot
		const pageResultAttempt = await this.buildResultsFromRows(pageRows);

		// Candidate sourcing from owned_games by recency; intersect with apps on this page first
		const pageAppIds = Array.from(new Set(pageRows.map((r) => r.app_id)));
		let candidateBase: number[] = [];
		if (this.userIds.size > 0) {
			const ids = Array.from(this.userIds);
			candidateBase = await this.getCandidateAppsFromOwnedGamesForUsers(ids, policy.candidateWindowFromOwned);
		} else if (this.friendsOfUserId) {
			// Scope by the requesting user's recent play history to stay bounded
			candidateBase = await this.getCandidateAppsFromOwnedGames(
				this.friendsOfUserId,
				policy.candidateWindowFromOwned,
			);
		}

		// Order candidates: prefer intersection first, then remaining to bound early work
		const pageSet = new Set(pageAppIds);
		const candidateSet = new Set(candidateBase);
		const intersection = pageSet.intersection(candidateSet);
		const remaining = pageSet.symmetricDifference(candidateSet);
		const orderedCandidates = [...intersection, ...remaining];

		// Set fetch limit for scoped ensure with potentially many concurrent API calls
		getFetchManager().reset({ maxFetches: Math.min(orderedCandidates.length * 10, 400) }); // Estimate up to 10 API calls per app, cap at 400

		// Scoped ensure with streaming micro-batches under caps/time budget; never throw due to caps
		const ensureAttempt = await this.ensureUserAchievementDataExists(policy, orderedCandidates);

		// Return the page we already have; include any ensure error as partial
		const data = pageResultAttempt.hasData() ? pageResultAttempt.data : [];
		const err = pageResultAttempt.error || ensureAttempt.error || null;
		return Attempt.from(data, err);
	}

	/**
	 * Execute using pure SQL composition (for complex cases with unlocked filtering)
	 * Uses a single comprehensive SQL query with JOINs instead of parameter explosion
	 */
	private async executeWithComprehensiveSQL(
		options: ComposableQueryOptions<UserAchievementSortMethod>,
	): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
		// Comprehensive path (search/unlocked/rarity or wide metadata needs)

		// Step 1: Determine actual user filtering approach
		const userFilterConditions: SQL[] = [];

		let ensureResult: Attempt<void, AttemptStatus>;
		if (this.friendsOfUserId) {
			// Use JOIN with friends table instead of fetching friend IDs (avoids parameter explosion)
			// This will be handled in the main query JOIN, no separate userIds needed
			// But we still need to ensure the target user exists
			ensureResult = await this.ensureUserDataExists();
		} else if (this.userIds.size > 0) {
			// Direct user IDs are safe as they're top-level parameters
			const userIdsArray = Array.from(this.userIds);
			ensureResult = await this.ensureUserDataExists();
			userFilterConditions.push(inArray(userAchievements.user_id, userIdsArray));
		} else {
			// No scope
			return Attempt.ok([]);
		}

		// Step 2: Build comprehensive SQL query with all JOINs
		const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

		let query = this.db
			.with(...this.ctes)
			.select({
				user_id: userAchievements.user_id,
				app_id: userAchievements.app_id,
				ach_id: userAchievements.ach_id,
				unlocked_at: userAchievements.unlocked_at,
				rarity_pct: achievementsStats.percent,
				// Achievement metadata from achievements_meta
				display_name: achievementsMeta.display_name,
				description: achievementsMeta.description,
				default_value: achievementsMeta.default_value,
				hidden: achievementsMeta.hidden,
				icon: achievementsMeta.icon,
				icon_gray: achievementsMeta.icon_gray,
				// Also select the actual language used (for fallback detection)
				achievement_lang: achievementsMeta.lang,
				// App data (JSON field)
				app_data: apps.data,
				app_lang: apps.lang,
				estimated_players: estimatedPlayers.estimated_players,
			})
			.from(userAchievements)
			// JOIN to ensure user owns the game (handles "all owned games" case)
			.innerJoin(
				ownedGames,
				and(eq(userAchievements.user_id, ownedGames.user_id), eq(userAchievements.app_id, ownedGames.app_id)),
			)
			// JOIN for achievement metadata with fallback logic (requested language -> English)
			.innerJoin(
				achievementsMeta,
				and(
					eq(userAchievements.app_id, achievementsMeta.app_id),
					eq(userAchievements.ach_id, achievementsMeta.ach_id),
					// Fallback logic: try requested language first, then English
					super.createLanguageFallbackCondition(userAchievements.app_id, userAchievements.ach_id, apiCode),
				),
			)
			// JOIN for app data
			.innerJoin(apps, and(eq(userAchievements.app_id, apps.id), eq(apps.lang, apiCode)))
			// LEFT JOIN for rarity data
			.leftJoin(
				achievementsStats,
				and(
					eq(userAchievements.app_id, achievementsStats.app_id),
					eq(userAchievements.ach_id, achievementsStats.ach_id),
				),
			)
			// LEFT JOIN for estimated players (for rarity score calculation)
			.leftJoin(estimatedPlayers, eq(userAchievements.app_id, estimatedPlayers.app_id))
			.$dynamic();

		// Build WHERE conditions using shared collectors (safe params + base filters + rarity/search)
		const sortPieces2 = this.buildRaritySortPieces(
			options.sort,
			achievementsStats.percent,
			estimatedPlayers.estimated_players,
		);
		const whereConditions: SQL[] = this.collectWhereConditions(...userFilterConditions, ...sortPieces2.where);

		// Apply friends filter using JOIN (if not already applied)
		if (this.friendsOfUserId) {
			query = query.innerJoin(
				friends,
				and(eq(friends.friend_id, userAchievements.user_id), eq(friends.user_id, this.friendsOfUserId)),
			);
		}
		// Apply all WHERE conditions
		query = query.where(and(...whereConditions));

		// Apply sorting
		query = this.applySorting(query, options);

		// Apply pagination
		if (options.limit) {
			query = query.limit(options.limit);
		}

		if (options.cursor) {
			query = query.offset(options.cursor);
		}

		// Execute comprehensive query

		const rows = await query;

		// Step 3: Build results directly from comprehensive query results
		return ensureResult.and(await this.buildResultsFromComprehensiveRows(rows));
	}

	/**
	 * Build final SteamUserAchievement objects from comprehensive query rows
	 * This handles rows that already include all achievement metadata from JOINs
	 */
	private async buildResultsFromComprehensiveRows(
		rows: Array<{
			user_id: string;
			app_id: number;
			ach_id: string;
			unlocked_at: Date | null;
			rarity_pct: number | null;
			display_name: string;
			description: string | null;
			default_value: number;
			hidden: number;
			icon: string;
			icon_gray: string;
			achievement_lang: APILanguageCode; // Language actually used for achievement metadata
			app_data: SteamAppRaw | null; // SteamAppRaw data
			app_lang: APILanguageCode; // APILanguageCode
			estimated_players: number | null;
		}>,
	): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
		if (rows.length === 0) {
			return Attempt.ok([]);
		}

		// Extract unique user IDs to fetch user data
		const uniqueUserIds = [...new Set(rows.map((row) => row.user_id))];

		// Fetch user data (we still need this as it's not in the main query) - now returns Attempt
		const userDataComposer = this.userRepository.compose().withUserIds(uniqueUserIds);
		if (this.freshnessCutoff) userDataComposer.withCutoff(this.freshnessCutoff);
		const userDataResult = await userDataComposer.build();

		// Even if user data fetch fails, we can try to build what we can
		// (though results will be empty without user data)
		const userMap = userDataResult.hasData() ? new Map(userDataResult.data.map((u) => [u.id, u])) : new Map();

		// For non-English requests, fetch English metadata to detect fallback cases
		let englishMetaMap = new Map<string, { display_name: string; description: string | null }>();
		if (this.lang !== "en") {
			const uniqueAppIds = [...new Set(rows.map((row) => row.app_id))];
			const englishRows = await this.db
				.select({
					app_id: achievementsMeta.app_id,
					ach_id: achievementsMeta.ach_id,
					display_name: achievementsMeta.display_name,
					description: achievementsMeta.description,
				})
				.from(achievementsMeta)
				.where(and(eq(achievementsMeta.lang, "english"), inArray(achievementsMeta.app_id, uniqueAppIds)));
			englishMetaMap = new Map(
				englishRows.map((row) => [
					`${row.app_id}-${row.ach_id}`,
					{ display_name: row.display_name, description: row.description },
				]),
			);
		}

		// Build results directly from comprehensive rows
		const results: SteamUserAchievement[] = [];

		for (const row of rows) {
			const user = userMap.get(row.user_id);

			// Skip if we don't have the user or the user is private (mirror buildResultsFromRows behavior)
			if (!user) continue;
			if (user.private) continue;

			if (row.app_data && row.display_name) {
				// Create SteamApp object from database data
				const app = new SteamApp({
					data: row.app_data,
					estimatedPlayers: row.estimated_players,
					lang: row.app_lang,
				});

				// Create achievement metadata in the format expected by SteamUserAchievement
				const meta = {
					name: row.ach_id,
					defaultvalue: row.default_value,
					displayName: row.display_name,
					hidden: row.hidden,
					description: row.description || "",
					icon: row.icon,
					icongray: row.icon_gray,
				};

				// Create global stats (handle null case)
				const globalStats =
					row.rarity_pct !== null
						? {
								name: row.ach_id,
								percent: row.rarity_pct,
							}
						: {
								name: row.ach_id,
								percent: 0, // Default value when no stats available
							};

				// Determine effective language using unified detection
				const effectiveLanguage = this.detectEffectiveLanguage(
					this.lang,
					row.achievement_lang,
					row.display_name,
					row.description,
					englishMetaMap,
					row.app_id,
					row.ach_id,
				);

				results.push(
					new SteamUserAchievement({
						app: app,
						meta: meta,
						globalStats: globalStats,
						lang: effectiveLanguage, // Use the detected effective language
						user: user,
						userStats: row.unlocked_at
							? {
									apiname: row.ach_id,
									achieved: 1,
									unlocktime: Math.floor(row.unlocked_at.getTime() / 1000),
								}
							: null,
					}),
				);
			}
		}

		// Comprehensive path build complete

		// Return success or partial based on whether we had any errors during user data fetching
		return Attempt.from(results, userDataResult.error);
	}

	/**
	 * Ensure user data exists in the database
	 *
	 * Note: For friends mode, we need to resolve the actual friend user IDs first
	 * because user data fetching requires the actual user IDs to fetch profile/owned games data.
	 * The query execution part uses JOINs to avoid parameter explosion.
	 */
	private async ensureUserDataExists(): Promise<Attempt<void, AttemptStatus>> {
		// For user data, we need to determine the actual users to upsert
		let friendsResult: ComposableQueryResult<SteamFriendUser> | null = null;
		let result: Attempt<void, AttemptStatus>;

		if (this.friendsOfUserId) {
			// When friendsOfUserId is set, we first need to ensure the friends data exists
			// This will populate the friends table if it doesn't exist yet
			// Ensuring friends data for requesting user
			const friendsComposer = this.friendsRepository.compose().withUserIds(this.friendsOfUserId);
			if (this.freshnessCutoff) friendsComposer.withCutoff(this.freshnessCutoff);
			// Ensure friend relationships/users without selecting 1000+ joined rows
			const friendsEnsureAttempt = await friendsComposer.ensureDataExists();
			// Mirror previous shape (optional) by creating a minimal ComposableQueryResult carrying the error
			friendsResult = new ComposableQueryResult<SteamFriendUser>([], 0, friendsEnsureAttempt.error);

			// Suppress non-build/count warnings per logging standard

			// Use subquery to get friend IDs instead of extracting them (avoids parameter explosion)
			// Subquery-based friend scoping

			// First, ensure user profile and owned games data exists using subquery
			// const friendUserIdsSubquery = sql`(
			//     SELECT DISTINCT friend_id AS user_id
			//     FROM friends
			//     WHERE user_id = ${this.friendsOfUserId}
			// )`;
			const friendUserIdsSubquery = this.db
				.selectDistinct({ id: friends.friend_id })
				.from(friends)
				.where(eq(friends.user_id, this.friendsOfUserId))
				.limit(1000)
				.as("required_users");

			const friendUsersComposer = this.userRepository
				.compose()
				.withRequiredEntitySubquery("user", friendUserIdsSubquery);
			if (this.freshnessCutoff) friendUsersComposer.withCutoff(this.freshnessCutoff);
			result = await friendUsersComposer.ensureDataExists();
		} else {
			const userIds = Array.from(this.userIds);
			if (userIds.length === 0) return Attempt.ok(undefined);

			// First, ensure user profile and owned games data exists
			const userEnsureComposer = this.userRepository.compose().withUserIds(userIds);
			if (this.freshnessCutoff) userEnsureComposer.withCutoff(this.freshnessCutoff);
			result = await userEnsureComposer.ensureDataExists();
		}

		// Then, ensure app data exists for the apps we'll be querying
		const appDataResult = await this.ensureAppDataExists();

		// Set fetch limit for user achievement data fetching (potentially many concurrent API calls)
		getFetchManager().reset({ maxFetches: 400 }); // Cap at 400 to stay well under Cloudflare's 1000 limit

		// Then, ensure user achievement data exists for their owned games
		const achievementResult = await this.ensureUserAchievementDataExists();

		// Combine all results - if any has an error, propagate it
		let finalResult = result.and(appDataResult).and(achievementResult);

		// Include friends result if it exists
		if (friendsResult) {
			finalResult = finalResult.and(Attempt.from(undefined, friendsResult.error));
		}

		return finalResult;
	}

	/**
	 * Fetch and upsert user achievement data for their owned games.
	 * Streaming micro-batches variant when EnsurePolicy.mode === "unlocked_at":
	 * - Small outer concurrency (FIFO per app), rely on global fetch limiter for HTTP concurrency.
	 * - Insert rows in slices of caps.maxRowsPerFlush and yield between flushes to avoid starving the event loop.
	 * - Enforce caps on apps/time; always return gracefully with partial backfill allowed.
	 *
	 * This interacts with the global fetch limiter by keeping DB write bursts small so network fetches across
	 * other ensure loops are not delayed. The limiter deals with total fetch count; we focus on burst size and pacing.
	 */
	private async ensureUserAchievementDataExists(
		policy?: EnsurePolicy,
		scopedAppIds?: number[],
	): Promise<Attempt<void, AttemptStatus>> {
		if (policy?.mode === "unlocked_at") {
			const perFlush = policy.caps.maxRowsPerFlush;
			const maxApps = policy.caps.maxAppsPerRequest;

			let processedApps = 0; // retained for maxApps limiting logic
			let firstError: Error | null = null;

			// Resolve target users
			let targetUserIds: string[] = [];
			if (this.friendsOfUserId) {
				const rows = await this.db
					.select({ uid: friends.friend_id })
					.from(friends)
					.where(eq(friends.user_id, this.friendsOfUserId))
					.limit(1000);
				targetUserIds = rows.map((r) => r.uid);
			} else if (this.userIds.size > 0) {
				targetUserIds = Array.from(this.userIds);
			} else {
				return Attempt.ok(undefined);
			}
			if (targetUserIds.length === 0) return Attempt.ok(undefined);

			// Candidate set (ordered)
			let candidates: number[] =
				scopedAppIds && scopedAppIds.length > 0
					? Array.from(new Set(scopedAppIds))
					: await this.getCandidateAppsFromOwnedGamesForUsers(targetUserIds, policy.candidateWindowFromOwned);
			if (candidates.length > maxApps) candidates = candidates.slice(0, maxApps);

			const maybeYield = async () => {
				// Yield to allow the fetch limiter to interleave other tasks
				await Promise.resolve();
			};

			// Iterate candidates; rely on caps and fetch limiter to keep us in check
			for (const appId of candidates) {
				for (const userId of targetUserIds) {
					try {
						const achievements = await this.steamApi.getPlayerAchievements({
							steamid: userId,
							appid: appId,
						});

						const list: Array<{
							user_id: string;
							app_id: number;
							ach_id: string;
							unlocked_at: Date | null;
						}> = [];

						if (achievements?.playerstats?.achievements) {
							for (const ach of achievements.playerstats.achievements) {
								list.push({
									user_id: userId,
									app_id: Number(appId),
									ach_id: ach.apiname,
									unlocked_at:
										ach.achieved && ach.unlocktime > 0 ? new Date(ach.unlocktime * 1000) : null,
								});
							}
						}

						for (let i = 0; i < list.length; i += perFlush) {
							const batch = list.slice(i, i + perFlush);
							if (batch.length === 0) continue;

							await safeInsert(this.db, batch, (chunk) =>
								this.db
									.insert(userAchievements)
									.values(
										chunk.map((data) => ({
											user_id: data.user_id,
											app_id: data.app_id,
											ach_id: data.ach_id,
											unlocked_at: data.unlocked_at,
											updated_at: new Date(),
										})),
									)
									.onConflictDoUpdate({
										target: [
											userAchievements.user_id,
											userAchievements.app_id,
											userAchievements.ach_id,
										],
										set: {
											unlocked_at: excluded(userAchievements.unlocked_at),
											updated_at: new Date(),
										},
									}),
							);
							// processedRows removed (debug only)
							await maybeYield();
						}
					} catch (err) {
						if (!firstError) firstError = err as Error;
					}
				}

				processedApps++;
				if (processedApps >= maxApps) {
					break;
				}
				await maybeYield();
			}

			return Attempt.from(undefined, firstError);
		}

		// Legacy path (rarity_pct/search or default flows): keep existing behavior
		// Build base query that will be used for both owned games and missing data queries
		let baseQuery = this.db
			.selectDistinct({
				user_id: ownedGames.user_id,
				app_id: ownedGames.app_id,
			})
			.from(ownedGames)
			.$dynamic();

		// Apply user filtering - use different approaches for friends vs direct user IDs
		if (this.friendsOfUserId) {
			// Use JOIN with friends table to get owned games for friends (avoids parameter explosion)
			baseQuery = baseQuery
				.innerJoin(friends, eq(friends.friend_id, ownedGames.user_id))
				.where(eq(friends.user_id, this.friendsOfUserId));
		} else if (this.userIds.size > 0) {
			const filterUserIds = Array.from(this.userIds);
			baseQuery = baseQuery.where(inArray(ownedGames.user_id, filterUserIds));
		} else {
			return Attempt.ok(undefined);
		}

		// Apply app filtering if specified
		const appFilterIds = Array.from(this.appIds);
		if (appFilterIds.length > 0) {
			baseQuery = baseQuery.where(inArray(ownedGames.app_id, appFilterIds));
		}

		// Get all owned games for the target users
		const ownedGamesResult = await baseQuery;

		if (ownedGamesResult.length === 0) {
			return Attempt.ok(undefined);
		}

		// Debug metrics suppressed (user-game pairs / unique users / games)

		// Now find missing user achievement data using the same filtering approach
		const apiCode = getLanguageByCode(this.lang)?.apiCode || "english";

		// Build missing data query with the same user filtering logic
		let missingDataQuery = this.db
			.selectDistinct({
				user_id: ownedGames.user_id,
				app_id: ownedGames.app_id,
			})
			.from(ownedGames)
			.innerJoin(
				achievementsMeta,
				and(eq(achievementsMeta.app_id, ownedGames.app_id), eq(achievementsMeta.lang, apiCode)),
			)
			.leftJoin(
				userAchievements,
				and(
					eq(userAchievements.user_id, ownedGames.user_id),
					eq(userAchievements.app_id, ownedGames.app_id),
					eq(userAchievements.ach_id, achievementsMeta.ach_id),
				),
			)
			.$dynamic();

		// Apply the same user filtering as above
		const whereConditions: SQL[] = [];
		if (this.freshnessCutoff) {
			const cutoff: Date = this.freshnessCutoff; // narrow for type system
			// Treat rows missing OR stale (updated_at older than cutoff) as needing refresh
			whereConditions.push(
				or(isNull(userAchievements.ach_id) as SQL, lt(userAchievements.updated_at, cutoff) as SQL) as SQL,
			);
		} else {
			whereConditions.push(isNull(userAchievements.ach_id) as SQL);
		}
		if (this.friendsOfUserId) {
			// Use JOIN with friends table for friends filtering
			missingDataQuery = missingDataQuery.innerJoin(friends, eq(friends.friend_id, ownedGames.user_id));
			whereConditions.push(eq(friends.user_id, this.friendsOfUserId));
		} else if (this.userIds.size > 0) {
			const filterUserIds = Array.from(this.userIds);
			whereConditions.push(inArray(ownedGames.user_id, filterUserIds));
		}

		// Apply app filtering if specified
		if (appFilterIds.length > 0) {
			whereConditions.push(inArray(ownedGames.app_id, appFilterIds));
		}

		missingDataQuery = missingDataQuery.where(and(...whereConditions));

		const missingData = await missingDataQuery;

		if (missingData.length === 0) {
			return Attempt.ok(undefined);
		}
		// Need to fetch missing achievement data combinations

		const fetchUserAchievements = async (row: { user_id: string; app_id: number }) => {
			const { user_id, app_id } = row;
			const achievements = await this.steamApi.getPlayerAchievements({
				steamid: user_id,
				appid: app_id,
			});

			const achievementList: Array<{
				user_id: string;
				app_id: number;
				ach_id: string;
				unlocked_at: Date | null;
			}> = [];

			if (achievements?.playerstats?.achievements) {
				for (const ach of achievements.playerstats.achievements) {
					achievementList.push({
						user_id,
						app_id: Number(app_id),
						ach_id: ach.apiname,
						unlocked_at: ach.achieved && ach.unlocktime > 0 ? new Date(ach.unlocktime * 1000) : null,
					});
				}
			}

			return achievementList;
		};

		// Fetch all user achievements concurrently with partial result support
		console.debug(`[UserAchievementRepository] Requesting ${missingData.length} entries`);
		const achievementsResult = await Attempt.all(missingData.map((row) => fetchUserAchievements(row)));

		// Collect all achievement data from successful fetches
		const achievementDataToInsert = achievementsResult.data.flat();
		const accumulatedError = achievementsResult.error;

		if (achievementDataToInsert.length > 0) {
			console.debug(`[UserAchievementRepository] Upsert ${achievementDataToInsert.length} entries`);
			// Insert achievement data in chunks to avoid SQL parameter limits (database operation - let it throw)
			await safeInsert(
				this.db,
				achievementDataToInsert.filter((d) => d !== undefined),
				(batch) =>
					this.db
						.insert(userAchievements)
						.values(
							batch.map((data) => ({
								user_id: data.user_id,
								app_id: data.app_id,
								ach_id: data.ach_id,
								unlocked_at: data.unlocked_at,
								updated_at: new Date(),
							})),
						)
						.onConflictDoUpdate({
							target: [userAchievements.user_id, userAchievements.app_id, userAchievements.ach_id],
							set: {
								unlocked_at: excluded(userAchievements.unlocked_at),
								updated_at: new Date(),
							},
						}),
			);
		}

		// Return appropriate result based on whether we encountered errors
		return Attempt.from(undefined, accumulatedError);
	}

	/**
	 * Ensure app data exists in the database for the apps we'll be querying
	 * Uses subquery-based approach to avoid parameter explosion
	 */
	private async ensureAppDataExists(): Promise<Attempt<void, AttemptStatus>> {
		// Build subquery for required apps using the same logic as our main query
		const requiredAppsSubquery = this.buildRequiredAppsScope();

		if (!requiredAppsSubquery) {
			// No derived app scope
			return Attempt.ok(undefined);
		}

		// Ensure app data via subquery scope

		// Use the App repository with subquery-based data ensuring
		const appDataComposer = this.appRepository
			.compose()
			.withLanguage(this.lang)
			.withRequiredEntitySubquery("apps", requiredAppsSubquery)
			.withUnlockedAtMode(this.ensurePolicy?.mode === "unlocked_at")
			.withPlayerEstimateRefresh(false);
		// Intentionally don't check for app freshness
		// if (this.freshnessCutoff) appDataComposer.withCutoff(this.freshnessCutoff);
		// Ensure only; avoid selecting potentially hundreds of app rows
		const appDataResult = await appDataComposer.ensureDataExists();

		if (appDataResult.error) {
			console.warn(
				`[UserAchievementRepository] Failed to ensure all data exists: ${appDataResult.error.message}`,
			);
			return Attempt.partial(undefined, appDataResult.error);
		}

		// App data ensured
		return Attempt.ok(undefined);
	}

	/**
	 * Build final SteamUserAchievement objects from database rows
	 */
	private async buildResultsFromRows(
		userAchievementRows: Array<{
			user_id: string;
			app_id: number;
			ach_id: string;
			unlocked_at: Date | null;
			rarity_pct: number | null;
		}>,
	): Promise<Attempt<SteamUserAchievement[], AttemptStatus>> {
		if (userAchievementRows.length === 0) {
			return Attempt.ok([]);
		}

		// Extract unique user IDs (this is typically bounded by pagination/filtering)
		const uniqueUserIds = [...new Set(userAchievementRows.map((row) => row.user_id))];
		const uniqueAppIds = [...new Set(userAchievementRows.map((row) => row.app_id))];

		// Use safe approach for app achievements to avoid parameter explosion
		let appAchievementsResult: Attempt<SteamAppAchievement[]>;

		if (uniqueAppIds.length <= 50) {
			// Safe to use direct approach for small sets
			const achComposer = this.appAchievementRepository
				.compose()
				.withLanguage(this.lang)
				.withAppIds(uniqueAppIds);
			// No withCutoff on AppAchievement composer
			appAchievementsResult = await achComposer.build();
		} else {
			// For larger sets, chunk the requests
			// TODO this is still giving me PTSD
			const CHUNK_SIZE = 50;
			const chunks: number[][] = [];
			for (let i = 0; i < uniqueAppIds.length; i += CHUNK_SIZE) {
				chunks.push(uniqueAppIds.slice(i, i + CHUNK_SIZE));
			}

			const chunkResults = await Promise.all(
				chunks.map((chunk) =>
					(() => {
						const chunkComposer = this.appAchievementRepository
							.compose()
							.withLanguage(this.lang)
							.withAppIds(chunk);
						// No withCutoff on AppAchievement composer
						return chunkComposer.build();
					})(),
				),
			);

			// Combine results
			const allAppAchievements: SteamAppAchievement[] = [];
			let firstError: Error | null = null;

			for (const result of chunkResults) {
				if (result.hasData()) {
					allAppAchievements.push(...result.data);
				} else if (!firstError) {
					firstError = new Error("Failed to fetch app achievements chunk");
				}
			}

			appAchievementsResult = Attempt.from(allAppAchievements, firstError);
		}

		const userDataComposer2 = this.userRepository.compose().withUserIds(uniqueUserIds);
		if (this.freshnessCutoff) userDataComposer2.withCutoff(this.freshnessCutoff);
		const userDataResult = await userDataComposer2.build();

		// Combine both attempts - if either failed, we can still try to build partial results
		const combinedResult = appAchievementsResult.and(userDataResult);

		// Extract the data from the successful attempts (or empty arrays if failed)
		const appAchievements = appAchievementsResult.hasData() ? appAchievementsResult.data : [];
		const userData = userDataResult.hasData() ? userDataResult.data : [];

		// Create lookup maps
		const appAchievementMap = new Map(appAchievements.map((a) => [`${a.app.id}-${a.id}`, a]));
		const userMap = new Map(userData.map((u) => [u.id, u]));

		// Combine data
		const results: SteamUserAchievement[] = [];

		for (const row of userAchievementRows) {
			const user = userMap.get(row.user_id);
			if (!user) continue;
			if (user.private) continue; // Skip private users

			const appAchievement = appAchievementMap.get(`${row.app_id}-${row.ach_id}`);

			if (user && appAchievement) {
				results.push(
					new SteamUserAchievement({
						app: appAchievement.app,
						meta: appAchievement.serialize().meta,
						globalStats: appAchievement.serialize().globalStats,
						lang: appAchievement.serialize().lang,
						user: user,
						userStats: row.unlocked_at
							? {
									apiname: row.ach_id,
									achieved: 1,
									unlocktime: Math.floor(row.unlocked_at.getTime() / 1000),
								}
							: null,
					}),
				);
			}
		}

		// Final results built

		// Return success or partial based on whether we had any errors during dependency fetching
		return Attempt.from(results, combinedResult.error);
	}
}

export class UserAchievementRepository
	implements
		Repository<SteamUserAchievement, UserAchievementSortMethod>,
		ComposableRepository<SteamUserAchievement, UserAchievementSortMethod, UserAchievementQueryComposer>
{
	constructor(
		private sqlite: ProjectDB,
		private steamApi: SteamAuthenticatedAPIClient,
		private appAchievementRepository: AppAchievementRepository,
		private userRepository: UserRepository,
		private friendsRepository: FriendsRepository,
		private appRepository: AppRepository,
	) {}

	/**
	 * Create a new composable query builder
	 */
	compose(): UserAchievementQueryComposer {
		return new UserAchievementQueryComposer(
			this.sqlite,
			this.steamApi,
			this.appAchievementRepository,
			this.userRepository,
			this.friendsRepository,
			this.appRepository,
		);
	}
}

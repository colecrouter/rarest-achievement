import { and, asc, countDistinct, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import type { WithSubqueryWithSelection } from "drizzle-orm/sqlite-core/subquery";
import {
	Attempt,
	type AttemptStatus,
	getFetchManager,
	ownedGames,
	type ProjectDB,
	type SteamAuthenticatedAPI,
	users,
} from "../..";
import { SteamUser, type SteamUserRaw } from "../../models";
import type { OwnedGame } from "../api/steampowered/owned";
import {
	type ComposableQueryOptions,
	type ComposableQueryResult,
	type ComposableRepository,
	createQueryResult,
	type RequiredSubquery,
	type SubqueryConsumer,
} from "../composable";
import { RequiredEntityStore } from "../entitySubqueries";
import type { Repository } from "../repository";
import { excluded } from "./operators";
import { safeInsert } from "./utils";

type UserSortMethod = "id";

// Precise CTE type for "required users" subquery (selects a single "id" column)
type RequiredUsersSubquery = WithSubqueryWithSelection<{ id: typeof users.id }, string>;

class UserQueryComposer<WithOwnedApps extends boolean = false>
	extends RequiredEntityStore<"user">
	implements SubqueryConsumer<SteamUser<WithOwnedApps>, UserSortMethod>
{
	private userIds = new Set<string>();
	private requiredUserSubquery?: RequiredUsersSubquery;
	/** If set, treat rows with updated_at older than this Date as missing */
	private freshnessCutoff: Date | undefined;
	/** Whether to hydrate ownedGames for returned users */
	private includeOwnedGames: boolean = false;

	constructor(
		private db: ProjectDB,
		private steamApi: SteamAuthenticatedAPI,
	) {
		super(db, { user: users.id });
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
	 * Accept a subquery that defines which user IDs are required
	 */
	withRequiredEntitySubquery(entityType: string, subquery: RequiredSubquery): this {
		if (entityType === "user") {
			// Narrow the generic RequiredSubquery to the expected selection shape for users
			this.requiredUserSubquery = subquery as RequiredUsersSubquery;
		}
		return this;
	}

	/**
	 * Provide a freshness cutoff (ms since epoch). Any existing DB row with updated_at < cutoff
	 * is considered stale and will be re-fetched by ensureDataExists. If not provided, existing
	 * rows are accepted regardless of age (current behavior).
	 */
	withCutoff(cutoff: Date): this {
		this.freshnessCutoff = cutoff;
		return this;
	}

	/**
	 * Control whether owned games should be hydrated for users.
	 * Set to false for lightweight profile lookups to avoid the large ownedGames join.
	 */
	// Discriminated builder: when called, narrows the composer to include owned games
	withOwnedApps(this: UserQueryComposer<false>): UserQueryComposer<true>;
	withOwnedApps(this: UserQueryComposer<boolean>): UserQueryComposer<boolean> {
		this.includeOwnedGames = true;
		// Cast is safe: once includeOwnedGames is enabled, caller should treat composer as <true>
		return this as unknown as UserQueryComposer<true>;
	}

	/**
	 * Build and execute the composed query
	 */
	async build(
		options: ComposableQueryOptions<UserSortMethod> = {},
	): Promise<ComposableQueryResult<SteamUser<WithOwnedApps>>> {
		// Ensure data exists first
		const ensureResult = await this.ensureDataExists();
		if (ensureResult.error)
			console.warn(`[UserRepository] Failed to ensure all data exists: ${ensureResult.error.message}`);

		// Execute main query
		const items = await this.executeDirectQuery(options);

		// Combine errors using Attempt chaining
		return createQueryResult(items, options.cursor, ensureResult.error);
	}

	/**
	 * Execute a COUNT over the logical result set produced by the current composition.
	 * - Ensures data before read (calls ensureDataExists)
	 * - Reuses the same filters as build(): withUserIds(); additionally, if a required-user subquery
	 *   was provided, counts DISTINCT users present in that subquery intersected with existing users.
	 * - No ordering or pagination; COUNT only.
	 */
	async count(): Promise<Attempt<number, AttemptStatus>> {
		// Ensure-before-read: capture error but attempt COUNT regardless

		const ensureRes = await this.ensureDataExists();
		if (ensureRes.error)
			console.warn(`[UserRepository] Failed to ensure all data exists: ${ensureRes.error.message}`);

		// If a required user subquery is specified, count distinct users in that subquery that exist in users
		if (this.requiredUserSubquery) {
			let q = this.db
				.select({
					cnt: countDistinct(users.id),
				})
				.from(this.requiredUserSubquery)
				.innerJoin(users, eq(users.id, this.requiredUserSubquery.id))
				.$dynamic();

			if (this.userIds.size > 0) {
				q = q.where(inArray(users.id, Array.from(this.userIds)));
			}

			const rows = await q;
			const cnt = rows[0]?.cnt ?? 0;
			return ensureRes.map(() => cnt);
		}

		// Otherwise, base count from users with optional explicit ID filter
		let q = this.db
			.select({
				cnt: countDistinct(users.id),
			})
			.from(users)
			.$dynamic();

		if (this.userIds.size > 0) {
			q = q.where(inArray(users.id, Array.from(this.userIds)));
		}

		const rows = await q;
		const cnt = rows[0]?.cnt ?? 0;
		return ensureRes.map(() => cnt);
	}

	/**
	 * Ensure user data exists in the database, fetching from API if needed
	 */
	async ensureDataExists(): Promise<Attempt<void, AttemptStatus>> {
		// Find missing users using subquery pattern when available
		// Note: Database errors (SQL issues) should bubble up, not be caught
		const missingUserIds = await this.findMissingUsers();

		const profiles = await this.fetchAndUpsertUsers(missingUserIds);
		// New users still load their libraries. Existing profiles only need a library
		// refresh when a caller explicitly needs ownership data.
		if (missingUserIds.length === 0 && !this.includeOwnedGames) return profiles;
		const libraries = await this.ensureOwnedGamesDataExists();
		return Attempt.from(undefined, profiles.error ?? libraries.error);
	}

	/**
	 * Find user IDs that are missing from the database
	 */
	private async findMissingUsers(): Promise<string[]> {
		// If we have a required user subquery, first collect those IDs, then filter by existing fresh rows.
		if (this.requiredUserSubquery) {
			// Anti-join strategy to avoid materializing a large IN (...) list.
			// We LEFT JOIN users; rows where users.id IS NULL are missing entirely.
			// If a freshness cutoff is provided, rows with users.updated_at < cutoff are treated as missing.
			const staleOrMissingCondition = this.freshnessCutoff
				? or(isNull(users.id), lt(users.updated_at, this.freshnessCutoff))
				: isNull(users.id);

			const missingRows = await this.db
				.select({ user_id: this.requiredUserSubquery.id })
				.from(this.requiredUserSubquery)
				.leftJoin(users, eq(users.id, this.requiredUserSubquery.id))
				.where(staleOrMissingCondition);

			return missingRows.map((r) => r.user_id);
		}

		// Explicit user IDs path
		if (this.userIds.size > 0) {
			const explicitIds = Array.from(this.userIds);
			if (explicitIds.length === 0) return [];
			let existingQ = this.db
				.select({ id: users.id, updated_at: users.updated_at })
				.from(users)
				.where(inArray(users.id, explicitIds))
				.$dynamic();
			if (this.freshnessCutoff) existingQ = existingQ.where(gte(users.updated_at, this.freshnessCutoff));
			const existing = await existingQ;
			const existingFresh = new Set(existing.map((r) => r.id));
			return explicitIds.filter((id) => !existingFresh.has(id));
		}

		return [];
	}

	/**
	 * Fetch and upsert user data from Steam API
	 */
	private async fetchAndUpsertUsers(missingUserIds: string[]): Promise<Attempt<void, AttemptStatus>> {
		if (missingUserIds.length === 0) {
			return Attempt.ok(undefined);
		}

		console.debug(`[UserRepository] Requesting ${missingUserIds.length} entries`);

		const summaries = await Attempt.try(() => this.steamApi.getPlayerSummaries(missingUserIds));
		const players = summaries.data?.response.players ?? [];
		await safeInsert(this.db, players, (chunk) =>
			this.db
				.insert(users)
				.values(
					chunk.map((data) => ({
						id: data.steamid,
						data,
						updated_at: new Date(),
					})),
				)
				.onConflictDoUpdate({
					target: users.id,
					set: { data: excluded(users.data), updated_at: excluded(users.updated_at) },
				}),
		);
		return summaries.map(() => undefined);
	}

	private async ensureOwnedGamesDataExists(): Promise<Attempt<void, AttemptStatus>> {
		if (!this.requiredUserSubquery && this.userIds.size === 0) return Attempt.ok(undefined);
		const stale = this.freshnessCutoff
			? or(isNull(users.ownedGamesUpdatedAt), lt(users.ownedGamesUpdatedAt, this.freshnessCutoff))
			: isNull(users.ownedGamesUpdatedAt);
		const scope = this.requiredUserSubquery
			? inArray(users.id, this.db.select({ id: this.requiredUserSubquery.id }).from(this.requiredUserSubquery))
			: inArray(users.id, Array.from(this.userIds));
		// Bound external requests and the amount of library data held in memory.
		const limit = 32;
		const missing = await this.db
			.select({ id: users.id })
			.from(users)
			.where(and(scope, stale))
			.orderBy(asc(users.ownedGamesUpdatedAt), asc(users.id))
			.limit(limit + 1);
		let error: Error | null =
			missing.length > limit
				? new Error("More Steam libraries need refreshing; deferred to a later request")
				: null;
		getFetchManager().reset({ maxFetches: 150 });
		for (const { id } of missing.slice(0, limit)) {
			const attempt = await Attempt.try(() =>
				this.steamApi.getOwnedGames({
					steamid: id,
					include_played_free_games: true,
				}),
			);
			if (attempt.error || !attempt.data) {
				// Keep this library stale. A successful profile fetch must not suppress retries.
				const reason =
					attempt.error?.message.replace(/https?:\/\/\S+/g, "[Steam API URL]") ?? "empty API response";
				error ??= new Error(`Steam library fetch failed for user ${id}: ${reason}`);
				continue;
			}
			const response = attempt.data.response;
			const games = "games" in response && Array.isArray(response.games) ? response.games : [];
			if ("game_count" in response && Number(response.game_count) > 0 && games.length === 0) {
				error ??= new Error(`Steam returned an incomplete library for user ${id}`);
				continue;
			}
			const updatedAt = new Date();
			// Write the completion timestamp only after every game has been persisted.
			// Private libraries ({response:{}}) and genuinely empty libraries are cacheable.
			await safeInsert(this.db, games, (chunk) =>
				this.db
					.insert(ownedGames)
					.values(
						chunk.map((game) => ({
							user_id: id,
							app_id: game.appid,
							last_played_at: game.rtime_last_played ? new Date(game.rtime_last_played * 1000) : null,
							playtime_2w_minutes: game.playtime_2weeks ?? null,
							playtime_total_minutes: game.playtime_forever ?? null,
							updated_at: updatedAt,
						})),
					)
					.onConflictDoUpdate({
						target: [ownedGames.user_id, ownedGames.app_id],
						set: {
							last_played_at: excluded(ownedGames.last_played_at),
							playtime_2w_minutes: excluded(ownedGames.playtime_2w_minutes),
							playtime_total_minutes: excluded(ownedGames.playtime_total_minutes),
							updated_at: excluded(ownedGames.updated_at),
						},
					}),
			);
			await this.db.update(users).set({ ownedGamesUpdatedAt: updatedAt }).where(eq(users.id, id));
		}
		return Attempt.from(undefined, error);
	}

	/**
	 * Execute the primary (direct) user query for current composition state.
	 */
	private async executeDirectQuery(
		options: ComposableQueryOptions<UserSortMethod>,
	): Promise<SteamUser<WithOwnedApps>[]> {
		const sortDir = options.sort?.direction === "desc" ? desc : asc;
		const sortMethod = users.id; // Only supported sort currently

		let userQuery = this.db
			.select({ id: users.id, data: users.data })
			.from(users)
			.orderBy(sortDir(sortMethod))
			.$dynamic();

		if (this.userIds.size > 0) {
			userQuery = userQuery.where(inArray(users.id, Array.from(this.userIds)));
		}
		if (options.limit !== undefined) userQuery = userQuery.limit(options.limit);
		if (options.cursor !== undefined) userQuery = userQuery.offset(options.cursor);

		const userRows = await userQuery;
		if (userRows.length === 0) return [];

		// Fast path: profiles only
		if (!this.includeOwnedGames) {
			return userRows.map(
				({ data }) => new SteamUser<false>({ data, ownedApps: undefined as never }),
			) as unknown as SteamUser<WithOwnedApps>[];
		}

		// Owned games path: collect per-user arrays
		let userIdsSubquery = this.db.select({ id: users.id }).from(users).orderBy(sortDir(sortMethod)).$dynamic();
		if (this.userIds.size > 0) userIdsSubquery = userIdsSubquery.where(inArray(users.id, Array.from(this.userIds)));
		if (options.limit !== undefined) userIdsSubquery = userIdsSubquery.limit(options.limit);
		if (options.cursor !== undefined) userIdsSubquery = userIdsSubquery.offset(options.cursor);

		const ownedGamesRows = await this.db
			.select({
				user_id: ownedGames.user_id,
				app_id: ownedGames.app_id,
				playtime_total_minutes: ownedGames.playtime_total_minutes,
				playtime_2w_minutes: ownedGames.playtime_2w_minutes,
				last_played_at: ownedGames.last_played_at,
			})
			.from(ownedGames)
			.where(inArray(ownedGames.user_id, userIdsSubquery))
			.orderBy(asc(ownedGames.user_id), asc(ownedGames.app_id));

		const map = new Map<string, { data: SteamUserRaw; games: OwnedGame<false>[] }>();
		for (const row of userRows) map.set(row.id, { data: row.data, games: [] });
		for (const game of ownedGamesRows) {
			const entry = map.get(game.user_id);
			if (!entry) continue;
			entry.games.push({
				appid: game.app_id,
				playtime_forever: game.playtime_total_minutes ?? undefined,
				playtime_2weeks: game.playtime_2w_minutes ?? undefined,
				rtime_last_played: game.last_played_at ? game.last_played_at.getTime() / 1000 : undefined,
			});
		}

		return Array.from(
			map.values(),
			({ data, games }) => new SteamUser<true>({ data, ownedApps: games }),
		) as unknown as SteamUser<WithOwnedApps>[];
	}
}

export class UserRepository
	implements
		Repository<SteamUser<false>, UserSortMethod>,
		ComposableRepository<SteamUser<false>, UserSortMethod, UserQueryComposer<false>>
{
	constructor(
		private sqlite: ProjectDB,
		private steamApi: SteamAuthenticatedAPI,
	) {}

	/**
	 * Create a new composable query builder
	 */
	compose(): UserQueryComposer<false> {
		return new UserQueryComposer<false>(this.sqlite, this.steamApi);
	}
}

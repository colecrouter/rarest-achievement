import { asc, countDistinct, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
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

		if (missingUserIds.length === 0) {
			return Attempt.ok(undefined);
		}

		// Fetch and insert missing user data
		// Note: API errors are handled inside fetchAndUpsertUsers, DB errors bubble up
		return await this.fetchAndUpsertUsers(missingUserIds);
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

		const validData = [];

		// Fetch user summaries
		const missingPlayerSummaries = await Attempt.try(() => {
			return this.steamApi.getPlayerSummaries(missingUserIds);
		});

		// Fetch owned games for each user
		getFetchManager().reset({ maxFetches: 150 }); // We'll say max 150 users for now (who am I kidding, I am making this up as I go)
		const missingOwnedGames = await Attempt.all(
			missingUserIds.map((userId) => {
				return this.steamApi
					.getOwnedGames({ steamid: userId, include_played_free_games: true })
					.then((d) => (d && "games" in d.response && d.response.games ? d.response.games : []))
					.then((d) => ({ user: userId, games: d }));
			}),
		);

		// Combine user data
		for (const userId of missingUserIds) {
			const userData = missingPlayerSummaries.data?.response.players.find((u) => u.steamid === userId);
			const ownedGamesData = missingOwnedGames.data.find((o) => o?.user === userId);

			if (userData) {
				validData.push({
					id: userData.steamid,
					user: userData,
					ownedGames: ownedGamesData ? ownedGamesData.games : [],
				});
			}
		}

		console.debug(`[UserRepository] Upsert ${validData.length} entries`);

		// Insert missing data into the database
		// Note: Database errors should bubble up, not be caught
		await Promise.all([
			safeInsert(this.db, validData, (u) =>
				this.db
					.insert(users)
					.values(
						u.map((data) => ({
							id: data.id,
							data: data.user,
							updated_at: new Date(),
						})),
					)
					.onConflictDoUpdate({
						target: users.id,
						set: {
							data: excluded(users.data),
							updated_at: new Date(),
						},
					}),
			),
			safeInsert(
				this.db,
				validData.flatMap((d) =>
					d.ownedGames.map((g) => ({
						user_id: d.id,
						ownedGames: g,
					})),
				),
				(u) =>
					this.db
						.insert(ownedGames)
						.values(
							u.map((data) => ({
								user_id: data.user_id,
								app_id: data.ownedGames.appid,
								last_played_at: data.ownedGames.rtime_last_played
									? new Date(data.ownedGames.rtime_last_played * 1000) // Convert seconds to milliseconds
									: null,
								playtime_2w_minutes: data.ownedGames.playtime_2weeks ?? null,
								playtime_total_minutes: data.ownedGames.playtime_forever ?? null,
							})),
						)
						.onConflictDoUpdate({
							target: [ownedGames.user_id, ownedGames.app_id],
							set: {
								last_played_at: excluded(ownedGames.last_played_at),
								playtime_2w_minutes: excluded(ownedGames.playtime_2w_minutes),
								playtime_total_minutes: excluded(ownedGames.playtime_total_minutes),
							},
						}),
			),
		]);

		console.debug(`[UserRepository] Upsert ${validData.length} entries`);

		// Combine errors from both API calls using Attempt chaining
		const combinedResult = missingPlayerSummaries.and(missingOwnedGames.map(() => undefined));
		return combinedResult;
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

import { asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { Attempt, type AttemptStatus, friends, ownedGames, type ProjectDB, users } from "../..";
import { SteamFriendUser } from "../../models";
import type { SteamUserRaw } from "../../models/SteamUser";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import {
	type ComposableQueryOptions,
	type ComposableQueryResult,
	type ComposableRepository,
	createQueryResult,
	type QueryComposer,
} from "../composable";
import type { Repository } from "../repository";
import type { UserRepository } from "./User";
import { safeInsert } from "./utils";

type FriendsSortMethod = "id" | "friend_since";

class FriendsQueryComposer implements QueryComposer<SteamFriendUser, FriendsSortMethod> {
	private userIds = new Set<string>();
	/** Optional freshness cutoff for friend relationship & user freshness propagation */
	private freshnessCutoff: Date | undefined;

	constructor(
		private db: ProjectDB,
		private steamApi: SteamAuthenticatedAPIClient,
		private userRepository: UserRepository,
	) {}

	/**
	 * Filter by a single user ID whose friends we want to get
	 */
	withUserIds(userId: string | Iterable<string>): this {
		if (typeof userId === "string") {
			this.userIds.add(userId);
		} else {
			for (const id of userId) {
				this.userIds.add(id);
			}
		}

		return this;
	}

	/** Treat any existing friend/user rows older than cutoff as missing */
	withCutoff(cutoff: Date): this {
		this.freshnessCutoff = cutoff;
		return this;
	}

	/**
	 * Build and execute the composed query
	 */
	async build(
		options: ComposableQueryOptions<FriendsSortMethod> = {},
	): Promise<ComposableQueryResult<SteamFriendUser>> {
		// Ensure data exists first (non-fatal on partial failure)
		let ensureError: Error | null = null;
		let ensureAttemptError: Error | null = null;
		try {
			const ensureAttempt = await this.ensureDataExists();
			ensureAttemptError = ensureAttempt.error;
			if (ensureAttempt.error) console.warn("Failed to ensure friends data exists:", ensureAttempt.error);
		} catch (err) {
			ensureError = err as Error; // DB-level failure
			console.warn("Failed to ensure friends data exists (thrown):", ensureError);
		}

		let items: SteamFriendUser[] = [];
		let queryError: Error | null = null;
		try {
			items = await this.executeDirectQuery(options);
		} catch (err) {
			queryError = err as Error;
			console.warn("Friends query failed, returning partial results:", queryError);
		}

		const combined = Attempt.from(undefined, ensureError || ensureAttemptError).and(
			Attempt.from(undefined, queryError),
		);
		return createQueryResult(items, options.cursor, combined.error);
	}

	/**
	 * Execute a COUNT over the logical result set of friends for the specified userIds.
	 * - Ensures data before read (calls ensureDataExists)
	 * - Returns COUNT(DISTINCT friends.friend_id) for friends.user_id IN (ids)
	 * - If no userIds were provided, returns Ok(0) to mirror build()'s empty result
	 * - No ORDER BY/LIMIT/OFFSET
	 */
	async count(): Promise<Attempt<number, AttemptStatus>> {
		// Empty scope: mirror build() which returns an empty list
		if (this.userIds.size === 0) {
			return Attempt.ok(0);
		}

		// Ensure-before-read; capture Attempt error or thrown DB error
		let ensureError: Error | null = null;
		try {
			const ensureAttempt = await this.ensureDataExists();
			ensureError = ensureAttempt.error;
		} catch (err) {
			ensureError = err as Error;
		}

		try {
			const ids = Array.from(this.userIds);
			const rows = await this.db
				.select({
					cnt: sql<number>`count(distinct ${friends.friend_id})`,
				})
				.from(friends)
				.where(inArray(friends.user_id, ids));

			const cnt = rows[0]?.cnt ?? 0;
			return ensureError ? Attempt.partial(cnt, ensureError) : Attempt.ok(cnt);
		} catch (err) {
			return Attempt.fail<number>(err as Error);
		}
	}

	/**
	 * Ensure friend data exists in the database, fetching from API if needed
	 */
	private async ensureDataExists(): Promise<Attempt<void, AttemptStatus>> {
		if (this.userIds.size === 0) return Attempt.ok(undefined);

		const ids = Array.from(this.userIds);
		let combined: Attempt<undefined, AttemptStatus> = Attempt.ok(undefined);

		// First ensure main users exist in the users table
		const userComposer = this.userRepository.compose().withUserIds(ids);
		if (this.freshnessCutoff) userComposer.withCutoff(this.freshnessCutoff);
		const userEnsureResult = await userComposer.ensureDataExists();
		if (userEnsureResult.error)
			console.warn("Failed to ensure users exist for friends query:", userEnsureResult.error);
		combined = combined.and(userEnsureResult.map(() => undefined));

		// Fetch summary to figure out what friends data is missing
		// This is consumer-controlled (friends composer controls user IDs), so inArray is safe
		let existingFriendsQ = this.db
			.selectDistinct({ user_id: friends.user_id, updated_at: friends.updated_at })
			.from(friends)
			.where(inArray(friends.user_id, ids))
			.$dynamic();
		if (this.freshnessCutoff) {
			existingFriendsQ = existingFriendsQ.where(gte(friends.updated_at, this.freshnessCutoff));
		}
		const existingFriendsUsers = await existingFriendsQ;

		const existingUserIds = new Set(existingFriendsUsers.map((r) => r.user_id));
		const missingUserIds = new Set(ids.filter((id) => !existingUserIds.has(id)));

		// Fetch friends lists for users that don't have friends data yet
		if (missingUserIds.size !== 0) {
			// Fetch friends lists for users missing relationships

			// Fetch friends lists from Steam API
			const friendsListData = await Attempt.all(
				Array.from(missingUserIds).map(async (userId) => {
					const result = await this.steamApi.getFriendsList({
						steamid: userId,
						relationship: "friend",
					});
					return { userId, friendsList: result.friendslist.friends };
				}),
			);
			if (friendsListData.error) console.warn("Failed to fetch some friends lists:", friendsListData.error);
			combined = combined.and(friendsListData.map(() => undefined));

			if (friendsListData.data) {
				// Collect all unique friend IDs
				const allFriendIds = new Set<string>();
				const friendsToInsert = friendsListData.data.flatMap((r) => {
					if (r === undefined) return []; // Skip undefined results
					const { userId, friendsList } = r;
					return friendsList.map((friend) => {
						allFriendIds.add(friend.steamid);
						return {
							user_id: userId,
							friend_id: friend.steamid,
							friend_since: new Date(friend.friend_since * 1000), // Convert Unix timestamp to Date
						};
					});
				});

				// Ensure all friend users exist in the users table AFTER inserting friend relationships
				// First, insert friend relationships to avoid parameter explosion in user data fetching
				if (friendsToInsert.length > 0) {
					// Insert new friend relationships (no updates on conflict)
					await safeInsert(
						this.db,
						friendsToInsert,
						(friendsBatch) => this.db.insert(friends).values(friendsBatch).onConflictDoNothing(), // Don't update existing friendships
					);
				}

				// Now ensure friend users exist using subquery from friends table (avoids parameter explosion)
				if (allFriendIds.size > 0) {
					// Create a typed subquery for friend user IDs (drizzle CTE) to satisfy UserRepository type expectations
					const friendUserIdsSubquery = this.db
						.selectDistinct({ id: friends.friend_id })
						.from(friends)
						.where(inArray(friends.user_id, Array.from(this.userIds)))
						.as("required_users");

					const friendUserComposer = this.userRepository
						.compose()
						// Cast to RequiredSubquery to satisfy SubqueryConsumer method type
						.withRequiredEntitySubquery("user", friendUserIdsSubquery);
					if (this.freshnessCutoff) friendUserComposer.withCutoff(this.freshnessCutoff);
					const friendUsersResult = await friendUserComposer.ensureDataExists();
					if (friendUsersResult.error)
						console.warn("Some friend users could not be fetched:", friendUsersResult.error);
					combined = combined.and(friendUsersResult.map(() => undefined));
				}
			}
		}
		return combined;
	}

	/**
	 * Execute the main friends query
	 */
	private async executeDirectQuery(options: ComposableQueryOptions<FriendsSortMethod>): Promise<SteamFriendUser[]> {
		if (this.userIds.size === 0) {
			return [];
		}

		const ids = Array.from(this.userIds);

		// Get users for friends via subquery (avoids parameter explosion & intermediate arrays)
		const sortMethod =
			options.sort?.method === "friend_since" ? sql`${friends.friend_since}` : sql`${friends.friend_id}`;
		const sortDirection = options.sort?.direction !== "desc" ? desc : asc;

		// Create a typed subquery for the friend user IDs we need (avoids parameter explosion)
		const friendUserIdsSubquery = this.db
			.selectDistinct({ id: friends.friend_id })
			.from(friends)
			.where(inArray(friends.user_id, ids))
			.as("required_users");

		const friendUsersEnsureResult = await this.userRepository
			.compose()
			// Cast to RequiredSubquery to satisfy SubqueryConsumer method type
			.withRequiredEntitySubquery("user", friendUserIdsSubquery)
			.ensureDataExists();
		if (friendUsersEnsureResult.error) {
			console.warn("Failed to ensure friend user data exists:", friendUsersEnsureResult.error);
		}

		// Fetch original users for mapping
		const originalUsersResponse = await this.userRepository
			.compose()
			.withUserIds(ids)
			.build({
				sort: { method: "id", direction: "asc" },
				limit: ids.length,
			});

		if (!originalUsersResponse.data) {
			return [];
		}

		const originalUsersMap = new Map(originalUsersResponse.data.map((u) => [u.serialize().data.steamid, u]));

		// Build main query with pagination and owned games in a single query to avoid parameter explosion
		// Use SQL-level pagination instead of application-level pagination
		const friendsWithGamesQuery = this.db
			.select({
				userId: friends.user_id,
				friendId: users.id,
				userData: users.data,
				friendSince: friends.friend_since,
				updatedAt: users.updated_at,
				// Owned games data
				gameUserId: ownedGames.user_id,
				appId: ownedGames.app_id,
				playtime2weeks: ownedGames.playtime_2w_minutes,
				playtimeForever: ownedGames.playtime_total_minutes,
				rtimeLastPlayed: ownedGames.last_played_at,
			})
			.from(friends)
			.innerJoin(users, eq(users.id, friends.friend_id))
			.leftJoin(ownedGames, eq(ownedGames.user_id, friends.friend_id))
			.where(inArray(friends.user_id, ids))
			.orderBy(sortDirection(sortMethod))
			.limit(options.limit || 1000)
			.offset(options.cursor || 0);

		const allRows = await friendsWithGamesQuery;

		// Group the results by friend
		const friendsMap = new Map<
			string,
			{
				userId: string;
				friendId: string;
				userData: SteamUserRaw;
				friendSince: Date;
				updatedAt: Date;
				ownedGames: Array<{
					appId: number;
					playtime2weeks: number | null;
					playtimeForever: number | null;
					rtimeLastPlayed: Date | null;
				}>;
			}
		>();

		for (const row of allRows) {
			if (!friendsMap.has(row.friendId)) {
				friendsMap.set(row.friendId, {
					userId: row.userId,
					friendId: row.friendId,
					userData: row.userData,
					friendSince: row.friendSince,
					updatedAt: row.updatedAt,
					ownedGames: [],
				});
			}

			const friend = friendsMap.get(row.friendId);
			if (!friend) throw new Error(`Friend ${row.friendId} not found in map`);
			if (row.appId !== null) {
				friend.ownedGames.push({
					appId: row.appId,
					playtime2weeks: row.playtime2weeks,
					playtimeForever: row.playtimeForever,
					rtimeLastPlayed: row.rtimeLastPlayed,
				});
			}
		}

		const friendRows = Array.from(friendsMap.values());

		const items = friendRows.map((row) => {
			const originalUser = originalUsersMap.get(row.userId);
			if (!originalUser) throw new Error(`Original user ${row.userId} missing`);

			// Transform owned games data to match OwnedGame<false> format
			const ownedApps = row.ownedGames.map((game) => ({
				appid: game.appId,
				playtime_2weeks: game.playtime2weeks ?? undefined,
				playtime_forever: game.playtimeForever ?? undefined,
				rtime_last_played: game.rtimeLastPlayed ? Math.floor(game.rtimeLastPlayed.getTime() / 1000) : undefined,
			}));

			return new SteamFriendUser({
				data: row.userData,
				ownedApps,
				friend: originalUser,
				friendData: {
					steamid: row.friendId,
					relationship: "friend",
					friend_since: row.friendSince.getTime(),
				},
			});
		});

		return items;
	}
}

export class FriendsRepository
	implements
		Repository<SteamFriendUser, FriendsSortMethod>,
		ComposableRepository<SteamFriendUser, FriendsSortMethod, FriendsQueryComposer>
{
	constructor(
		private sqlite: ProjectDB,
		private steamApi: SteamAuthenticatedAPIClient,
		private userRepository: UserRepository,
	) {}

	/**
	 * Create a new composable query builder
	 */
	compose(): FriendsQueryComposer {
		return new FriendsQueryComposer(this.sqlite, this.steamApi, this.userRepository);
	}
}

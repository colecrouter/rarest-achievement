import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AttemptStatus } from "../../src/error";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { ownedGames, users } from "../../src/repositories/sqlite/schema.js";
import { makeUser } from "../e2e/user";
import { makeUserRepoWithMocks } from "../fixtures/mockHelpers";
import { makeUserData } from "../fixtures/userData";
import { createLocalBudget, decorateWithBudget } from "../helpers/fetchBudget";
import { runMigrations } from "../helpers/migrate";
import { setupMockFetchWithManager } from "../helpers/mockFetchWithManager";
import type { MockSteamAuthenticatedAPIClient } from "../mocks/steamAuthenticated";

describe("UserRepository - SQLite (in-memory)", () => {
	let db: ProjectDB;
	let authMock: MockSteamAuthenticatedAPIClient;

	beforeEach(async () => {
		// Fresh in-memory DB per test case
		const sqlite = new Database(":memory:");
		// Align sqlite behavior
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");

		await runMigrations(sqlite);
		db = drizzle(sqlite) as unknown as ProjectDB;
	});

	function getRepo() {
		const { repo, auth } = makeUserRepoWithMocks(db);
		authMock = auth;
		return repo;
	}

	test("basic fetch inserts missing users via API", async () => {
		const repo = getRepo();
		// No users in DB – mock API will return data for two users
		const ps: GetPlayerSummariesResponse = {
			response: {
				players: [makeUserData("123"), makeUserData("456")],
			},
		};
		authMock.setPlayerSummaries(ps);

		// Minimal owned games stubs aligned with repository's call signature
		const q123: GetOwnedGamesQuery<false> = { steamid: "123", include_played_free_games: true };
		const r123: GetOwnedGamesResponse<false> = {
			response: { game_count: 1, games: [{ appid: 1, playtime_forever: 0 }] },
		};
		authMock.setOwnedGames(q123, r123);

		const q456: GetOwnedGamesQuery<false> = { steamid: "456", include_played_free_games: true };
		const r456: GetOwnedGamesResponse<false> = {
			response: { game_count: 0, games: [] },
		};
		authMock.setOwnedGames(q456, r456);

		const result = await repo.compose().withUserIds(["123", "456"]).build();

		assert.strictEqual(result.data.length, 2, "Should return two users");
		const ids = result.data.map((u) => u.id).sort();
		assert.deepStrictEqual(ids, ["123", "456"]);
	});

	test("returns cached users without API", async () => {
		// Seed users directly without setting any API mocks
		await db.insert(users).values({
			id: "777",
			data: makeUserData("777"),
			updated_at: new Date(),
		});
		await db.insert(users).values({
			id: "888",
			data: makeUserData("888"),
			updated_at: new Date(),
		});

		const repo = getRepo();
		const result = await repo.compose().withUserIds(["777", "888"]).build();

		assert.strictEqual(result.data.length, 2, "Should return cached users without API");
		const ids = result.data.map((u) => u.id).sort();
		assert.deepStrictEqual(ids, ["777", "888"]);
	});

	test("filter by explicit user IDs", async () => {
		await db.insert(users).values({
			id: "111",
			data: makeUserData("111"),
			updated_at: new Date(),
		});
		await db.insert(users).values({
			id: "222",
			data: makeUserData("222"),
			updated_at: new Date(),
		});
		await db.insert(ownedGames).values({
			user_id: "111",
			app_id: 10,
			playtime_2w_minutes: 0,
			playtime_total_minutes: 0,
			last_played_at: null,
		});

		const repo = getRepo();
		const result = await repo.compose().withUserIds(["111"]).build();

		assert.strictEqual(result.data.length, 1, "Only one user should be returned");
		assert.strictEqual(result.data[0]?.id, "111");
	});

	test("pagination works (limit/offset)", async () => {
		// Insert three users
		await db.insert(users).values({
			id: "u1",
			data: makeUserData("u1"),
			updated_at: new Date(),
		});
		await db.insert(users).values({
			id: "u2",
			data: makeUserData("u2"),
			updated_at: new Date(),
		});
		await db.insert(users).values({
			id: "u3",
			data: makeUserData("u3"),
			updated_at: new Date(),
		});

		const repo = getRepo();
		// Intentionally using non-zero cursor to validate offset behavior in this test
		const result = await repo.compose().build({ limit: 2, cursor: 1 });

		// With limit 2 and offset 1 we expect users 2 and 3
		assert.strictEqual(result.data.length, 2);
		const ids = result.data.map((u) => u.id);
		assert.deepStrictEqual(ids, ["u2", "u3"]);
	});

	test("error handling - API failure returns empty result", async () => {
		const repo = getRepo();
		// Do not set player summaries for "999" so Attempt will capture the error and return empty results
		const q999: GetOwnedGamesQuery<false> = { steamid: "999", include_played_free_games: true };
		const r999: GetOwnedGamesResponse<false> | null = null;
		authMock.setOwnedGames(q999, r999);

		const result = await repo.compose().withUserIds(["999"]).build();

		// ensure no exception is thrown and result is empty
		assert.strictEqual(result.data.length, 0);
	});

	// Parallel fetch: summaries + per-user owned games under a tight budget
	test("parallel upsert: owned-games only for subset under budget", async () => {
		const repo = getRepo();

		// Prepare 20 users with deterministic IDs
		const usersE2E = Array.from({ length: 20 }, (_, i) => makeUser(`u-${i + 1}`));
		const userIds = usersE2E.map((u) => u.id);

		// Player summaries (single batched call)
		const ps: GetPlayerSummariesResponse = {
			response: { players: userIds.map((id) => makeUserData(id)) },
		};
		authMock.setPlayerSummaries(ps);

		// Owned games per user (distinct call per user)
		for (const id of userIds) {
			authMock.setOwnedGames(
				{ steamid: id, include_played_free_games: true },
				{ response: { game_count: 1, games: [{ appid: 101, playtime_forever: 0 }] } },
			);
		}

		// Budget: 1 summary + first ~8 owned-games calls
		const budget = createLocalBudget(1 + 8);
		decorateWithBudget(authMock, ["getPlayerSummaries", "getOwnedGames"], budget);

		const res = await repo.compose().withUserIds(userIds).build();
		assert.ok(res.isOk() || res.isPartial());

		// All summaries insert user rows
		const userRows = await db.select().from(users);
		assert.strictEqual(userRows.length, 20);

		// Only a budget-limited subset has ownedGames rows
		const ownedRows = await db.select().from(ownedGames);
		assert.ok(ownedRows.length >= 4 && ownedRows.length <= 8);
	});

	test("users upsert uses EXCLUDED.data", async () => {
		// Arrange: seed initial user
		const userId = "ux-1";
		const original = makeUserData(userId);
		await db.insert(users).values({
			id: userId,
			data: original,
			updated_at: new Date(),
		});

		// Act: upsert with modified payload; set uses excluded.data
		const modified = { ...original, personaname: "Changed Persona" };
		await db
			.insert(users)
			.values({
				id: userId,
				data: modified,
				updated_at: new Date(),
			})
			.onConflictDoUpdate({
				target: users.id,
				set: {
					data: excluded(users.data),
					updated_at: new Date(),
				},
			});

		// Assert: stored row reflects modified.personaname
		const rows = await db.select({ data: users.data }).from(users).where(eq(users.id, userId));
		const stored = rows[0]?.data;
		assert.ok(stored, "user row should exist");
		assert.strictEqual(stored.personaname, "Changed Persona");
	});

	test("owned games upsert uses EXCLUDED fields", async () => {
		// Arrange: FK requires user to exist
		const userId = "og-user";
		await db.insert(users).values({
			id: userId,
			data: makeUserData(userId),
			updated_at: new Date(),
		});

		const appId = 424242;
		await db.insert(ownedGames).values({
			user_id: userId,
			app_id: appId,
			playtime_total_minutes: 10,
			playtime_2w_minutes: 1,
			last_played_at: null,
		});

		// Act: upsert same PK with different totals; set uses excluded.*
		await db
			.insert(ownedGames)
			.values({
				user_id: userId,
				app_id: appId,
				playtime_total_minutes: 20,
				playtime_2w_minutes: 2,
				last_played_at: new Date(0),
			})
			.onConflictDoUpdate({
				target: [ownedGames.user_id, ownedGames.app_id],
				set: {
					playtime_total_minutes: excluded(ownedGames.playtime_total_minutes),
					playtime_2w_minutes: excluded(ownedGames.playtime_2w_minutes),
					last_played_at: excluded(ownedGames.last_played_at),
				},
			});

		// Assert: final values are from EXCLUDED row
		const rows = await db
			.select({
				total: ownedGames.playtime_total_minutes,
				twoW: ownedGames.playtime_2w_minutes,
				last: ownedGames.last_played_at,
			})
			.from(ownedGames)
			.where(and(eq(ownedGames.user_id, userId), eq(ownedGames.app_id, appId)));
		assert.strictEqual(rows.length, 1);
		const row = rows[0];
		assert.ok(row, "owned game row should exist");
		assert.strictEqual(row.total, 20);
		assert.strictEqual(row.twoW, 2);
		assert.ok(row.last instanceof Date);
		assert.strictEqual(row.last.getTime(), 0);
	});

	test("withCutoff refetches stale user data", async () => {
		const repo = getRepo();
		const staleId = "fresh-1";
		const staleDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour old
		// Seed stale row with old persona name
		const baseOld = makeUserData(staleId);
		const oldData = { ...baseOld, personaname: "Old Name" } as typeof baseOld;
		await db.insert(users).values({ id: staleId, data: oldData, updated_at: staleDate });

		// Prepare API mock with updated persona name
		const baseNew = makeUserData(staleId);
		const newData = { ...baseNew, personaname: "New Name" } as typeof baseNew;
		const ps: GetPlayerSummariesResponse = { response: { players: [newData] } };
		authMock.setPlayerSummaries(ps);
		const ownedQ: GetOwnedGamesQuery<false> = { steamid: staleId, include_played_free_games: true };
		const ownedR: GetOwnedGamesResponse<false> = { response: { game_count: 0, games: [] } };
		authMock.setOwnedGames(ownedQ, ownedR);

		const cutoff = new Date(); // Anything older than 'now' is stale
		const result = await repo.compose().withUserIds([staleId]).withCutoff(cutoff).build();
		assert.strictEqual(result.data.length, 1);
		assert.strictEqual(result.data[0]?.serialize().data.personaname, "New Name", "Stale user should be refetched");
		// Verify updated_at changed
		const row = await db.select({ updated_at: users.updated_at }).from(users).where(eq(users.id, staleId));
		assert.ok(row[0]?.updated_at && row[0].updated_at > staleDate, "updated_at should be refreshed");
	});

	test("fetchAndUpsertUsers respects fetch manager limits", async () => {
		const repo = getRepo();
		let cleanupFetch: (() => void) | undefined;

		try {
			// Setup mock fetch
			cleanupFetch = setupMockFetchWithManager();

			// Mock some users that will require fetching
			const userIds = ["123", "456", "789"];

			// Setup player summaries response
			const ps: GetPlayerSummariesResponse = {
				response: {
					players: userIds.map((id) => makeUserData(id)),
				},
			};
			authMock.setPlayerSummaries(ps);

			// Setup owned games responses for each user
			for (const userId of userIds) {
				const ownedQ: GetOwnedGamesQuery<false> = {
					steamid: userId,
					include_played_free_games: true,
				};
				const ownedR: GetOwnedGamesResponse<false> = {
					response: {
						game_count: 2,
						games: [
							{ appid: 440, playtime_forever: 100 },
							{ appid: 730, playtime_forever: 200 },
						],
					},
				};
				authMock.setOwnedGames(ownedQ, ownedR);
			}

			// Build repository with the user IDs - this will trigger fetchAndUpsertUsers
			const result = await repo.compose().withUserIds(userIds).build();

			// Should succeed with fetch limiting
			assert.ok(result.isOk(), "fetchAndUpsertUsers should succeed with fetch limiting");
			assert.strictEqual(result.data.length, userIds.length, "All users should be fetched");
		} finally {
			cleanupFetch?.();
		}
	});

	test("ensureDataExists respects fetch manager limits", async () => {
		const repo = getRepo();
		let cleanupFetch: (() => void) | undefined;

		try {
			// Setup mock fetch
			cleanupFetch = setupMockFetchWithManager();

			// Mock some users that will require fetching
			const userIds = ["100", "200"];

			// Setup player summaries response
			const ps: GetPlayerSummariesResponse = {
				response: {
					players: userIds.map((id) => makeUserData(id)),
				},
			};
			authMock.setPlayerSummaries(ps);

			// Setup owned games responses for each user
			for (const userId of userIds) {
				const ownedQ: GetOwnedGamesQuery<false> = {
					steamid: userId,
					include_played_free_games: true,
				};
				const ownedR: GetOwnedGamesResponse<false> = {
					response: {
						game_count: 1,
						games: [{ appid: 570, playtime_forever: 50 }],
					},
				};
				authMock.setOwnedGames(ownedQ, ownedR);
			}

			// Build repository with the user IDs - this will call ensureDataExists internally
			const result = await repo.compose().withUserIds(userIds).build();

			// Should succeed with fetch limiting
			assert.ok(result.isOk(), "ensureDataExists should succeed with fetch limiting");
			assert.strictEqual(result.data.length, userIds.length, "All users should be available");
		} finally {
			cleanupFetch?.();
		}
	});
});

// Count() parity and error propagation tests for UserRepository
import { describe as describe_count_user, test as test_count_user } from "node:test";
import { excluded } from "../../src/repositories/sqlite/operators";

describe_count_user("UserRepository.count()", () => {
	test_count_user("parity: withUserIds equals build length", async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		const db = drizzle(sqlite) as unknown as ProjectDB;

		// Seed two users
		await db.insert(users).values({ id: "111", data: makeUserData("111"), updated_at: new Date() });
		await db.insert(users).values({ id: "222", data: makeUserData("222"), updated_at: new Date() });

		const { repo } = makeUserRepoWithMocks(db);

		const builderForBuild = repo.compose().withUserIds(["111", "222"]);
		const builderForCount = repo.compose().withUserIds(["111", "222"]);

		const buildRes = await builderForBuild.build();
		const countAttempt = await builderForCount.count();

		assert.strictEqual(countAttempt.status, AttemptStatus.Ok);
		assert.strictEqual(countAttempt.data, buildRes.data.length);
	});

	test_count_user("parity: no filter counts all users (matches build length without limit)", async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		const db = drizzle(sqlite) as unknown as ProjectDB;

		// Seed three users
		await db.insert(users).values({ id: "u1", data: makeUserData("u1"), updated_at: new Date() });
		await db.insert(users).values({ id: "u2", data: makeUserData("u2"), updated_at: new Date() });
		await db.insert(users).values({ id: "u3", data: makeUserData("u3"), updated_at: new Date() });

		const { repo } = makeUserRepoWithMocks(db);

		const buildRes = await repo.compose().build(); // no limit/cursor provided
		const countAttempt = await repo.compose().count();

		assert.strictEqual(countAttempt.status, AttemptStatus.Ok);
		assert.strictEqual(countAttempt.data, buildRes.data.length);
	});

	test_count_user("parity: required subquery combined with withUserIds", async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		const db = drizzle(sqlite) as unknown as ProjectDB;

		// Seed a superset of users
		await db.insert(users).values({ id: "su1", data: makeUserData("su1"), updated_at: new Date() });
		await db.insert(users).values({ id: "su2", data: makeUserData("su2"), updated_at: new Date() });
		await db.insert(users).values({ id: "suX", data: makeUserData("suX"), updated_at: new Date() });

		const { repo } = makeUserRepoWithMocks(db);

		// Typed Drizzle subquery for required users (selects real users.id column so repository can narrow types)
		const requiredUsersSubquery = db
			.select({ id: users.id })
			.from(users)
			.where(inArray(users.id, ["su1", "su2"]))
			.as("required_users");

		const builderForBuild = repo
			.compose()
			.withRequiredEntitySubquery("user", requiredUsersSubquery)
			.withUserIds(["su1", "su2"]);
		const builderForCount = repo
			.compose()
			.withRequiredEntitySubquery("user", requiredUsersSubquery)
			.withUserIds(["su1", "su2"]);

		const buildRes = await builderForBuild.build();
		const countAttempt = await builderForCount.count();

		assert.strictEqual(countAttempt.status, AttemptStatus.Ok);
		assert.strictEqual(countAttempt.data, buildRes.data.length);
	});
});

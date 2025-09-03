import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AttemptStatus } from "../../src/error";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { ownedGames, users } from "../../src/repositories/sqlite/schema.js";
import { makeUserRepoWithMocks } from "../fixtures/mockHelpers";
import { makeUserData } from "../fixtures/userData";
import { runMigrations } from "../helpers/migrate";
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

	test("error handling – API failure returns empty result", async () => {
		const repo = getRepo();
		// Do not set player summaries for "999" so Attempt will capture the error and return empty results
		const q999: GetOwnedGamesQuery<false> = { steamid: "999", include_played_free_games: true };
		const r999: GetOwnedGamesResponse<false> | null = null;
		authMock.setOwnedGames(q999, r999);

		const result = await repo.compose().withUserIds(["999"]).build();

		// ensure no exception is thrown and result is empty
		assert.strictEqual(result.data.length, 0);
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
					data: sql`excluded.data`,
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
					playtime_total_minutes: sql`excluded.playtime_total`,
					playtime_2w_minutes: sql`excluded.playtime_last_two_weeks`,
					last_played_at: sql`excluded.last_played_at`,
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
});

// Count() parity and error propagation tests for UserRepository
import { describe as describe_count_user, test as test_count_user } from "node:test";

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

		// Subquery that yields the required user ids
		const requiredUsersSubquery = sql`
            SELECT 'su1' AS user_id
            UNION
            SELECT 'su2' AS user_id
        `;

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

	test_count_user("error propagation: COUNT failure => AttemptStatus.Failure", async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		const db = drizzle(sqlite) as unknown as ProjectDB;

		// Seed a user
		await db.insert(users).values({ id: "boom", data: makeUserData("boom"), updated_at: new Date() });

		const { repo } = makeUserRepoWithMocks(db);
		const composer = repo.compose().withUserIds(["boom"]);

		// Force failure for COUNT by dropping the users table
		sqlite.exec("DROP TABLE users;");

		const attempt = await composer.count();

		assert.strictEqual(attempt.status, AttemptStatus.Failure);
		assert.ok(attempt.error);
	});
});

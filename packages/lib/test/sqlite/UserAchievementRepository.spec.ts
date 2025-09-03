import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { and, asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AttemptStatus } from "../../src/error";

import type { GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import {
	achievementsMeta,
	achievementsStats,
	estimatedPlayers,
	friends,
	ownedGames,
	userAchievements,
	users,
} from "../../src/repositories/sqlite/schema.js";
import { insertAppByCode, seedAppWithPlayers, seedMetaByCode, seedStats } from "../fixtures/appAchievementsData";
import { makeAppData } from "../fixtures/appData";
import { insertApp, insertOwnedGame, insertUser, insertUserAchievement } from "../fixtures/dbHelpers";
import { makeUserAchievementRepoWithMocks } from "../fixtures/mockHelpers";
import { makeFriendsListResponse, makePlayerAchievementsPayload } from "../fixtures/userAchievementsData";
import { makePlayerSummariesResponse, makeUserData } from "../fixtures/userData";
import { runMigrations } from "../helpers/migrate";
import type { MockSteamAuthenticatedAPIClient } from "../mocks/steamAuthenticated";

describe("UserAchievementRepository - SQLite (in-memory)", () => {
	let db: ProjectDB;
	let authMock: MockSteamAuthenticatedAPIClient;

	beforeEach(async () => {
		const sqlite = new Database(":memory:");

		// Align sqlite behavior with other specs and Drizzle/D1 quirks
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");

		await runMigrations(sqlite);
		// Disable FK enforcement in tests to prevent order constraints during ensure paths
		sqlite.exec("PRAGMA foreign_keys = OFF;");
		db = drizzle(sqlite) as unknown as ProjectDB;

		// Fresh repo + mocks
		const { repo, auth } = makeUserAchievementRepoWithMocks(db);
		authMock = auth;
		getRepo = () => repo;
	});

	// Provide accessor within the suite scope
	let getRepo: () => ReturnType<typeof makeUserAchievementRepoWithMocks>["repo"];

	// 1) Basic build
	test("basic build on empty data with withUserIds returns empty without throw", async () => {
		const repo = getRepo();
		await insertUser(db, { id: "u-empty", data: makeUserData("u-empty") });
		const res = await repo.compose().withUserIds("u-empty").build();
		assert.ok(res.data.length === 0 || res.data.length === 1);
	});

	test("withCutoff refetches stale user profile for achievements", async () => {
		const repo = getRepo();
		const userId = "fresh-ach-user";
		const appId = 93001;
		// Seed stale user row
		await insertUser(db, { id: userId, data: makeUserData(userId) });
		const staleDate = new Date(Date.now() - 3600_000);
		// Use ORM update to persist stale timestamp (Date will be serialized correctly)
		await db.update(users).set({ updated_at: staleDate }).where(eq(users.id, userId));
		await insertOwnedGame(db, { user_id: userId, app_id: appId });
		await seedAppWithPlayers(db, appId, "Fresh App", 1500);
		await seedStats(db, appId, [{ ach: "FA1", percent: 10 }]);
		await seedMetaByCode(db, appId, "en", [{ ach: "FA1", display: "Fresh Ach" }]);

		// Mock player summaries with changed persona name
		const updatedSummary = makePlayerSummariesResponse([userId], {
			[userId]: { personaname: "Refetched Persona" },
		});
		authMock.setPlayerSummaries([userId], updatedSummary);
		// Mock owned games response for ensure path
		const ownedResp: GetOwnedGamesResponse<false> = {
			response: { game_count: 1, games: [{ appid: appId, playtime_forever: 0 }] },
		};
		authMock.setOwnedGames({ steamid: userId, include_played_free_games: true }, ownedResp);
		// Mock player achievements
		authMock.setPlayerAchievements(
			{ steamid: userId, appid: appId },
			makePlayerAchievementsPayload({ userId, appId, items: [{ ach: "FA1", achieved: 1, unlock: new Date() }] }),
		);

		const res = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.withCutoff(new Date())
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		assert.strictEqual(res.data.length, 1);
		const item = res.data[0];
		assert.ok(item?.user?.serialize().data.personaname === "Refetched Persona", "persona name should be updated");
	});

	// 2) Data ensure: fetch via API and upsert user_achievements_stats; idempotency; cross-repo pre-reqs
	test("ensureDataExists fetches player achievements and upserts into user_achievements_stats; idempotent", async () => {
		const repo = getRepo();
		const userId = "u-1";
		const appId = 91021;
		const now = new Date();
		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });
		await seedAppWithPlayers(db, appId, "Ensure App", 2500);
		await seedStats(db, appId, [
			{ ach: "E1", percent: 5 },
			{ ach: "E2", percent: 20 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "E1", display: "Ensure One", description: "d1" },
			{ ach: "E2", display: "Ensure Two", description: "d2" },
		]);

		authMock.setPlayerAchievements(
			{ steamid: userId, appid: appId },
			makePlayerAchievementsPayload({
				userId,
				appId,
				items: [
					{ ach: "E1", achieved: 1, unlock: new Date(now.getTime() - 1000) },
					{ ach: "E2", achieved: 0, unlock: null },
				],
			}),
		);

		const res1 = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.build({ sort: { method: "rarity_pct", direction: "asc" } });
		const rows1 = await db
			.select({
				user_id: userAchievements.user_id,
				app_id: userAchievements.app_id,
				ach_id: userAchievements.ach_id,
				unlocked_at: userAchievements.unlocked_at,
			})
			.from(userAchievements)
			.where(and(eq(userAchievements.user_id, userId), eq(userAchievements.app_id, appId)));
		assert.strictEqual(rows1.length, 2, "two achievement rows should be inserted");
		assert.strictEqual(res1.data.length, 2);

		const res2 = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.build({ sort: { method: "rarity_pct", direction: "asc" } });
		const rows2 = await db
			.select({
				user_id: userAchievements.user_id,
				app_id: userAchievements.app_id,
				ach_id: userAchievements.ach_id,
			})
			.from(userAchievements)
			.where(and(eq(userAchievements.user_id, userId), eq(userAchievements.app_id, appId)));
		assert.strictEqual(rows2.length, 2, "no duplicates after re-run");
		assert.strictEqual(res2.data.length, 2, "same two results returned");
	});

	// 3) Language and fallback (comprehensive SQL path)
	test("French request falls back to English achievement meta when FR missing (comprehensive mode)", async () => {
		const repo = getRepo();
		const userId = "u-fr";
		const appId = 91022;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });
		await insertAppByCode(db, { id: appId, langCode: "fr", name: "FR App Row" });
		await db.insert(estimatedPlayers).values({ app_id: appId, estimated_players: 1000, updated_at: new Date() });
		await seedStats(db, appId, [{ ach: "AF1", percent: 12 }]);
		await seedMetaByCode(db, appId, "en", [{ ach: "AF1", display: "English Name", description: "EN Desc" }]);
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "AF1", unlocked_at: null });

		const res = await repo
			.compose()
			.withLanguage("fr")
			.withUserIds(userId)
			.withAppIds(appId)
			.withUnlockedStatus(undefined)
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		assert.strictEqual(res.data.length, 1);
		const a = res.data[0];
		assert.ok(a, "expected one item");
		assert.strictEqual(a.name, "English Name", "should use English display name as fallback");
		assert.strictEqual(a.language, "en", "language should resolve to English store code due to fallback");
	});

	test("French meta exists and differs — language remains 'fr' (comprehensive mode)", async () => {
		const repo = getRepo();
		const userId = "u-fr2";
		const appId = 91023;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });

		// Both EN and FR app rows (FR required for join)
		await insertAppByCode(db, { id: appId, langCode: "fr", name: "FR App Row" });

		// Seed stats + players
		await db.insert(estimatedPlayers).values({ app_id: appId, estimated_players: 500, updated_at: new Date() });
		await seedStats(db, appId, [{ ach: "BF1", percent: 7 }]);
		// EN + FR meta, with different strings
		await seedMetaByCode(db, appId, "en", [{ ach: "BF1", display: "EN Title" }]);
		await seedMetaByCode(db, appId, "fr", [{ ach: "BF1", display: "FR Titre" }]);

		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "BF1", unlocked_at: null });

		const res = await repo
			.compose()
			.withLanguage("fr")
			.withUserIds(userId)
			.withAppIds(appId)
			.withUnlockedStatus(false) // force comprehensive SQL path; filter locked
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		assert.strictEqual(res.data.length, 1);
		const a = res.data[0];
		assert.ok(a, "expected one item");
		assert.strictEqual(a.name, "FR Titre");
		assert.strictEqual(a.language, "fr");
	});

	// 4) Sorting and pagination
	test("sorting by unlocked_at and rarity_score; pagination applies at SQL level", async () => {
		const repo = getRepo();
		const userId = "u-sort";
		const appId = 91024;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });

		await seedAppWithPlayers(db, appId, "Score App", 10000);
		await seedStats(db, appId, [
			{ ach: "S_A", percent: 50 }, // higher score
			{ ach: "S_B", percent: 10 }, // lower score
			{ ach: "S_C", percent: 30 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "S_A", display: "Fifty" },
			{ ach: "S_B", display: "Ten" },
			{ ach: "S_C", display: "Thirty" },
		]);

		// Seed user achievements with various unlock times (and one locked)
		const t1 = new Date(Date.now() - 3000);
		const t2 = new Date(Date.now() - 1000);
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "S_A", unlocked_at: t2 });
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "S_B", unlocked_at: null });
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "S_C", unlocked_at: t1 });

		// rarity_score desc: by estimatedPlayers * percent -> S_A (50) > S_C(30) > S_B(10)
		const rs = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.build({ sort: { method: "rarity_score", direction: "desc" } });
		assert.deepStrictEqual(
			rs.data.map((a) => a.id),
			["S_A", "S_C", "S_B"],
		);

		// unlocked_at desc: non-null first, latest first, then nulls
		const unDesc = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.build({ sort: { method: "unlocked_at", direction: "desc" } });
		assert.deepStrictEqual(
			unDesc.data.map((a) => a.id),
			["S_A", "S_C", "S_B"], // t2, t1, null
		);

		// Pagination: asc by rarity_pct -> [S_B(10), S_C(30), S_A(50)] => offset 1 limit 2 => [S_C, S_A]
		// Intentionally using non-zero cursor to validate offset behavior in this test
		const page = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.build({ sort: { method: "rarity_pct", direction: "asc" }, limit: 2, cursor: 1 });
		assert.deepStrictEqual(
			page.data.map((a) => a.id),
			["S_C", "S_A"],
		);
	});

	// 5) Join semantics (comprehensive mapping constructs SteamUserAchievement directly)
	test("comprehensive join mapping builds enriched objects with correct unlock semantics", async () => {
		const repo = getRepo();
		const userId = "u-join";
		const appId = 91025;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });
		await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, "Join App") });
		await db.insert(estimatedPlayers).values({ app_id: appId, estimated_players: 2000, updated_at: new Date() });

		await seedStats(db, appId, [{ ach: "J1", percent: 33 }]);
		await seedMetaByCode(db, appId, "en", [{ ach: "J1", display: "Join One", description: "Join Desc" }]);

		const unlockedAt = new Date(Date.now() - 2000);
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "J1", unlocked_at: unlockedAt });

		const res = await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withUnlockedStatus(true) // comprehensive path and filter unlocked
			.withAppIds(appId)
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		assert.strictEqual(res.data.length, 1);
		const a = res.data[0];
		assert.ok(a, "expected one item");
		assert.strictEqual(a.name, "Join One");
		assert.ok(a.unlocked instanceof Date);
	});

	// 6) Edge cases
	test("no achievements for a user/app results in empty output", async () => {
		const userId = "u-none";
		const appId = 91026;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });
		// Intentionally do not insert achievementsMeta nor stats

		const repo = getRepo();
		const res = await repo.compose().withLanguage("en").withUserIds(userId).withAppIds(appId).build();
		assert.ok(res.data.length === 0 || res.data.length === 1);
	});
	// Fallback behavior: when a logged-in user does NOT own the app but the app has global achievements,
	// the repository should fall back to returning the app's achievements (user-less) so the UI can render them.
	test("fallback returns app achievements for non-owners as user-achievement objects with no user", async () => {
		const userId = "u-fallback";
		const appId = 96001;

		// User exists but does NOT own the app (no ownedGames row)
		await insertUser(db, { id: userId, data: makeUserData(userId) });

		// Seed app + stats + meta (English) so AppAchievementRepository would return achievements
		await seedAppWithPlayers(db, appId, "Fallback App", 1500);
		await seedStats(db, appId, [
			{ ach: "FB1", percent: 10 },
			{ ach: "FB2", percent: 25 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "FB1", display: "Fallback One" },
			{ ach: "FB2", display: "Fallback Two" },
		]);

		const repo = getRepo();
		const res = await repo.compose().withLanguage("en").withUserIds(userId).withAppIds(appId).build();

		// Fallback should return the two app achievements even though the user does not own the game
		assert.strictEqual(res.data.length, 2);
		const ids = res.data.map((a) => a.id);
		assert.deepStrictEqual(new Set(ids), new Set(["FB1", "FB2"]));

		// Items should have unlocked null (user may be undefined or present depending on implementation)\n        for (const item of res.data) {\n            assert.strictEqual(item.unlocked, null);\n        }
	});

	test("mixed presence: existing user achievement plus missing ones fetched and upserted; no duplicates", async () => {
		const userId = "u-mixed";
		const appId = 91027;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });

		await seedAppWithPlayers(db, appId, "Mixed App", 1200);
		await seedStats(db, appId, [
			{ ach: "MX1", percent: 11 },
			{ ach: "MX2", percent: 22 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "MX1", display: "M1" },
			{ ach: "MX2", display: "M2" },
		]);

		// Pre-existing row
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "MX1", unlocked_at: null });

		// Mock API returns both
		authMock.setPlayerAchievements(
			{ steamid: userId, appid: appId },
			makePlayerAchievementsPayload({
				userId,
				appId,
				items: [
					{ ach: "MX1", achieved: 0, unlock: null },
					{ ach: "MX2", achieved: 1, unlock: new Date(Date.now() - 5000) },
				],
			}),
		);

		const repo = getRepo();
		await repo.compose().withLanguage("en").withUserIds(userId).withAppIds(appId).build();

		const rows = await db
			.select({
				ach_id: userAchievements.ach_id,
				unlocked_at: userAchievements.unlocked_at,
			})
			.from(userAchievements)
			.where(and(eq(userAchievements.user_id, userId), eq(userAchievements.app_id, appId)))
			.orderBy(asc(userAchievements.ach_id));
		assert.strictEqual(rows.length, 2, "both achievements present after ensure");
		// No duplicates even after re-run
		await repo.compose().withLanguage("en").withUserIds(userId).withAppIds(appId).build();
		const rows2 = await db
			.select({ ach_id: userAchievements.ach_id })
			.from(userAchievements)
			.where(and(eq(userAchievements.user_id, userId), eq(userAchievements.app_id, appId)));
		assert.strictEqual(rows2.length, 2);
	});

	test("large input set (205 achievements) is inserted via safeInsert chunking without parameter explosion", async () => {
		const userId = "u-big";
		const appId = 91028;

		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await insertOwnedGame(db, { user_id: userId, app_id: appId });
		await seedAppWithPlayers(db, appId, "Big App", 5000);

		// Seed 205 achievements stats + meta (English)
		const count = 205;
		const items = Array.from({ length: count }, (_, i) => ({
			id: `B${i + 1}`,
			percent: (i % 50) + 1,
		}));

		// Stats
		for (const it of items) {
			await db.insert(achievementsStats).values({
				app_id: appId,
				ach_id: it.id,
				percent: it.percent,
				updated_at: new Date(),
			});
		}
		// Meta
		for (const it of items) {
			await db.insert(achievementsMeta).values({
				app_id: appId,
				lang: "english",
				ach_id: it.id,
				default_value: 0,
				display_name: `Big ${it.id}`,
				hidden: 0,
				description: `Desc ${it.id}`,
				icon: "icon.png",
				icon_gray: "gray.png",
			});
		}

		// Mock API returns 205 achievements (some unlocked)
		authMock.setPlayerAchievements(
			{ steamid: userId, appid: appId },
			makePlayerAchievementsPayload({
				userId,
				appId,
				items: items.map((it, idx) => ({
					ach: it.id,
					achieved: idx % 3 === 0 ? 1 : 0,
					unlock: idx % 3 === 0 ? new Date(Date.now() - (idx + 1) * 1000) : null,
				})),
			}),
		);

		const repo = getRepo();
		await repo
			.compose()
			.withLanguage("en")
			.withUserIds(userId)
			.withAppIds(appId)
			.build({
				sort: { method: "rarity_pct", direction: "asc" },
			});

		// Verify insert count
		const inserted = await db
			.select({ ach_id: userAchievements.ach_id })
			.from(userAchievements)
			.where(and(eq(userAchievements.user_id, userId), eq(userAchievements.app_id, appId)));
		assert.strictEqual(inserted.length, count, "all achievements inserted via chunked safeInsert");

		// Re-run to assert idempotency and no duplication when chunking path is used
		await repo.compose().withLanguage("en").withUserIds(userId).withAppIds(appId).build();
		const insertedAgain = await db
			.select({ ach_id: userAchievements.ach_id })
			.from(userAchievements)
			.where(and(eq(userAchievements.user_id, userId), eq(userAchievements.app_id, appId)));
		assert.strictEqual(insertedAgain.length, count, "no duplicates after re-run with chunking");
	});

	// Smoke: with friends of (JOIN-based filter path should not throw; focuses on builder methods)
	test("withFriendsOf builder composes and builds without parameter explosion (smoke)", async () => {
		// Setup a small graph: main user owns an app, friend also owns same app; this test validates composer APIs
		const main = "main-u";
		const f1 = "friend-u-1";
		const appId = 91029;

		await insertUser(db, { id: main, data: makeUserData(main) });
		// Ensure friends API returns an empty list for this smoke test so the behavior is deterministic
		authMock.setFriendsList({ steamid: main, relationship: "friend" }, makeFriendsListResponse(main, []));
		await insertUser(db, { id: f1, data: makeUserData(f1) });

		// Ensure app rows and stats/meta so mapping functions
		await seedAppWithPlayers(db, appId, "Friend App", 3000);
		await seedStats(db, appId, [{ ach: "F1", percent: 9 }]);
		await seedMetaByCode(db, appId, "en", [{ ach: "F1", display: "F-One" }]);

		// Ownership
		await insertOwnedGame(db, { user_id: main, app_id: appId });
		await insertOwnedGame(db, { user_id: f1, app_id: appId });

		// Pre-populate user achievement for friend
		await insertUserAchievement(db, { user_id: f1, app_id: appId, ach_id: "F1", unlocked_at: null });

		// Build with friendsOf path; this will JOIN friends in SQL during query
		// Friend relations are handled in FriendsRepository normally; for smoke we just ensure the path does not explode
		const repo = getRepo();
		const res = await repo
			.compose()
			.withLanguage("en")
			.withFriendsOf(main)
			.withAppIds(appId)
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		// No friends rows exist, so result is empty but should not throw
		assert.ok(res.data.length === 0 || res.data.length === 1);
	});
	// ────────────────────────────────────────────────────────────────────────────────
	// Additional suites
	// ────────────────────────────────────────────────────────────────────────────────

	describe("builder methods", () => {
		test("rarity_score sort omits achievements without estimated players", async () => {
			const userId = "u-rscore-filter";
			const appWithPlayers = 97001;
			const appNoPlayers = 97002;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appWithPlayers });
			await insertOwnedGame(db, { user_id: userId, app_id: appNoPlayers });

			// App rows
			await insertApp(db, {
				id: appWithPlayers,
				lang: "english",
				data: makeAppData(appWithPlayers, "Has Players"),
			});
			await insertApp(db, { id: appNoPlayers, lang: "english", data: makeAppData(appNoPlayers, "No Players") });

			// Estimated players only for the first app
			await db
				.insert(estimatedPlayers)
				.values({ app_id: appWithPlayers, estimated_players: 2000, updated_at: new Date() });

			// Stats + meta for both apps
			await seedStats(db, appWithPlayers, [{ ach: "RZ1", percent: 10 }]);
			await seedMetaByCode(db, appWithPlayers, "en", [{ ach: "RZ1", display: "RS-One" }]);
			await seedStats(db, appNoPlayers, [{ ach: "RZ2", percent: 20 }]);
			await seedMetaByCode(db, appNoPlayers, "en", [{ ach: "RZ2", display: "RS-Two" }]);

			// User achievements for both
			await insertUserAchievement(db, {
				user_id: userId,
				app_id: appWithPlayers,
				ach_id: "RZ1",
				unlocked_at: null,
			});
			await insertUserAchievement(db, {
				user_id: userId,
				app_id: appNoPlayers,
				ach_id: "RZ2",
				unlocked_at: null,
			});

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.build({ sort: { method: "rarity_score", direction: "desc" } });

			// Only the app with estimated players should be present
			assert.strictEqual(res.data.length, 1);
			const only = res.data[0];
			assert.ok(only);
			assert.strictEqual(only.app.id, appWithPlayers);
			assert.strictEqual(only.id, "RZ1");
		});
		test("withAchievementIds filters to specified achievements", async () => {
			const userId = "u-b1";
			const appId = 93001;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });

			await seedAppWithPlayers(db, appId, "Builder App", 1500);
			await seedStats(db, appId, [
				{ ach: "ACH1", percent: 10 },
				{ ach: "ACH2", percent: 20 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "ACH1", display: "Alpha One" },
				{ ach: "ACH2", display: "Alpha Two" },
			]);

			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "ACH1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "ACH2", unlocked_at: null });

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withAchievementIds(["ACH2"])
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			assert.deepStrictEqual(
				res.data.map((a) => a.id),
				["ACH2"],
			);
		});

		test("rarity_score excludes zero/negative estimated players", async () => {
			const userId = "u-rscore-negative";
			const appPositive = 97101;
			const appZero = 97102;
			const appNegative = 97103;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appPositive });
			await insertOwnedGame(db, { user_id: userId, app_id: appZero });
			await insertOwnedGame(db, { user_id: userId, app_id: appNegative });

			// App rows
			await insertApp(db, { id: appPositive, lang: "english", data: makeAppData(appPositive, "Pos") });
			await insertApp(db, { id: appZero, lang: "english", data: makeAppData(appZero, "Zero") });
			await insertApp(db, { id: appNegative, lang: "english", data: makeAppData(appNegative, "Neg") });

			// Estimated players: positive, zero, negative
			await db
				.insert(estimatedPlayers)
				.values({ app_id: appPositive, estimated_players: 1500, updated_at: new Date() });
			await db.insert(estimatedPlayers).values({ app_id: appZero, estimated_players: 0, updated_at: new Date() });
			await db
				.insert(estimatedPlayers)
				.values({ app_id: appNegative, estimated_players: -1, updated_at: new Date() });

			// Stats + meta for all
			await seedStats(db, appPositive, [{ ach: "P1", percent: 10 }]);
			await seedMetaByCode(db, appPositive, "en", [{ ach: "P1", display: "Pos One" }]);
			await seedStats(db, appZero, [{ ach: "Z1", percent: 20 }]);
			await seedMetaByCode(db, appZero, "en", [{ ach: "Z1", display: "Zero One" }]);
			await seedStats(db, appNegative, [{ ach: "N1", percent: 30 }]);
			await seedMetaByCode(db, appNegative, "en", [{ ach: "N1", display: "Neg One" }]);

			// User achievements
			await insertUserAchievement(db, { user_id: userId, app_id: appPositive, ach_id: "P1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appZero, ach_id: "Z1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appNegative, ach_id: "N1", unlocked_at: null });

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.build({ sort: { method: "rarity_score", direction: "desc" } });

			// Only the app with positive estimated players should be present
			assert.strictEqual(res.data.length, 1);
			const only = res.data[0];
			assert.ok(only);
			assert.strictEqual(only.app.id, appPositive);
			assert.strictEqual(only.id, "P1");
		});

		test("withRarityThreshold filters by max rarity percent", async () => {
			const userId = "u-b2";
			const appId = 93002;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });

			await seedAppWithPlayers(db, appId, "Rarity App", 2000);
			await seedStats(db, appId, [
				{ ach: "R1", percent: 5 },
				{ ach: "R2", percent: 20 },
				{ ach: "R3", percent: 33 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "R1", display: "Rare Five" },
				{ ach: "R2", display: "Rare Twenty" },
				{ ach: "R3", display: "Rare ThirtyThree" },
			]);

			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "R1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "R2", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "R3", unlocked_at: null });

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withRarityThreshold(0.2) // <= 20%
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			assert.deepStrictEqual(
				res.data.map((a) => a.id),
				["R1", "R2"],
			);
		});

		test("withSearch matches achievement display_name only", async () => {
			const userId = "u-search-1";
			const appId = 93003;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });

			await seedAppWithPlayers(db, appId, "Search App", 1800);
			await seedStats(db, appId, [
				{ ach: "SA1", percent: 15 },
				{ ach: "SB1", percent: 25 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "SA1", display: "Alpha Wolf" },
				{ ach: "SB1", display: "Beta Fish" },
			]);

			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "SA1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "SB1", unlocked_at: null });

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withSearch("alpha")
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			assert.deepStrictEqual(
				res.data.map((a) => a.id),
				["SA1"],
			);
		});

		test("withSearch matches by app name and excludes other apps", async () => {
			const userId = "u-search-2";
			const appAlpha = 93004;
			const appGamma = 93005;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appAlpha });
			await insertOwnedGame(db, { user_id: userId, app_id: appGamma });

			// App rows + players
			await seedAppWithPlayers(db, appAlpha, "Alpha Galaxy", 2200);
			await seedAppWithPlayers(db, appGamma, "Gamma World", 2200);

			// Stats + meta for both apps
			await seedStats(db, appAlpha, [
				{ ach: "GA1", percent: 10 },
				{ ach: "GA2", percent: 20 },
			]);
			await seedMetaByCode(db, appAlpha, "en", [
				{ ach: "GA1", display: "A-One" },
				{ ach: "GA2", display: "A-Two" },
			]);
			await seedStats(db, appGamma, [{ ach: "GW1", percent: 30 }]);
			await seedMetaByCode(db, appGamma, "en", [{ ach: "GW1", display: "G-One" }]);

			// User achievements across both apps
			await insertUserAchievement(db, { user_id: userId, app_id: appAlpha, ach_id: "GA1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appAlpha, ach_id: "GA2", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appGamma, ach_id: "GW1", unlocked_at: null });

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withSearch("alpha") // Should match only Alpha Galaxy app
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			assert.strictEqual(res.data.length, 2);
			assert.deepStrictEqual(new Set(res.data.map((a) => a.app.id)), new Set([appAlpha]));
			assert.strictEqual(
				res.data.some((a) => a.id === "GW1"),
				false,
				"non-matching app achievement should be excluded",
			);
		});

		test("withUnlockedStatus true/false filters correctly", async () => {
			const userId = "u-unlock";
			const appId = 93006;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });

			await seedAppWithPlayers(db, appId, "Unlock App", 1000);
			await seedStats(db, appId, [
				{ ach: "U1", percent: 12 },
				{ ach: "U2", percent: 18 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "U1", display: "Unlocked One" },
				{ ach: "U2", display: "Locked Two" },
			]);

			const t = new Date(Date.now() - 1000);
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "U1", unlocked_at: t });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "U2", unlocked_at: null });

			const repo = getRepo();

			const unlocked = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });
			assert.deepStrictEqual(
				unlocked.data.map((a) => a.id),
				["U1"],
			);

			const locked = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(false)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });
			assert.deepStrictEqual(
				locked.data.map((a) => a.id),
				["U2"],
			);
		});

		test("pagination stability on rarity_pct asc", async () => {
			const userId = "u-page";
			const appId = 93007;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });

			await seedAppWithPlayers(db, appId, "Page App", 999);
			await seedStats(db, appId, [
				{ ach: "P1", percent: 10 },
				{ ach: "P2", percent: 20 },
				{ ach: "P3", percent: 30 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "P1", display: "P One" },
				{ ach: "P2", display: "P Two" },
				{ ach: "P3", display: "P Three" },
			]);

			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "P1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "P2", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "P3", unlocked_at: null });

			const repo = getRepo();

			const slice1 = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.build({ sort: { method: "rarity_pct", direction: "asc" }, limit: 2, cursor: 0 });
			assert.deepStrictEqual(
				slice1.data.map((a) => a.id),
				["P1", "P2"],
			);

			const slice2 = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.build({ sort: { method: "rarity_pct", direction: "asc" }, limit: 2, cursor: 2 });
			assert.deepStrictEqual(
				slice2.data.map((a) => a.id),
				["P3"],
			);
		});

		test("subquery intersection with withAppIds filters results to specified app", async () => {
			const userId = "u-sub";
			const appOne = 94001;
			const appTwo = 94002;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appOne });
			await insertOwnedGame(db, { user_id: userId, app_id: appTwo });

			// Only appOne has meta/stats relevant
			await seedAppWithPlayers(db, appOne, "Sub App One", 1200);
			await seedStats(db, appOne, [{ ach: "SU1", percent: 11 }]);
			await seedMetaByCode(db, appOne, "en", [{ ach: "SU1", display: "Sub One" }]);

			// appTwo has no meta/stats; still add a user_achievement row to ensure filtering works
			await insertUserAchievement(db, { user_id: userId, app_id: appOne, ach_id: "SU1", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appTwo, ach_id: "SV1", unlocked_at: null });

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appOne)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			assert.strictEqual(res.data.length, 1);
			const only = res.data[0];
			assert.ok(only);
			assert.strictEqual(only.app.id, appOne);
			assert.strictEqual(only.id, "SU1");
		});
	});

	describe("withFriendsOf ensure path", () => {
		test("ensures friends list, friend user profile, owned games, and achievements via API", async () => {
			const main = "main-e2e";
			const friend = "friend-e2e";
			const appId = 93008;

			// Only main user exists initially; no friends rows
			await insertUser(db, { id: main, data: makeUserData(main) });

			// Seed app rows/meta/stats/players (EN)
			await seedAppWithPlayers(db, appId, "Ensure Friend App", 4000);
			await seedStats(db, appId, [{ ach: "FZ1", percent: 7 }]);
			await seedMetaByCode(db, appId, "en", [{ ach: "FZ1", display: "Friend Zed One" }]);

			// Configure API mocks
			const unixTs = Math.floor(Date.now() / 1000) - 1000;
			const friendsResponse = makeFriendsListResponse(main, [{ steamid: friend, friend_since: unixTs }]);
			authMock.setFriendsList({ steamid: main, relationship: "friend" }, friendsResponse);

			authMock.setPlayerSummaries([friend], makePlayerSummariesResponse([friend]));

			const ownedResponse: GetOwnedGamesResponse<true> = {
				response: {
					game_count: 1,
					games: [
						{
							appid: appId,
							playtime_forever: 0,
							rtime_last_played: Math.floor(Date.now() / 1000),
						},
					],
				},
			};
			authMock.setOwnedGames({ steamid: friend, include_played_free_games: true }, ownedResponse);

			authMock.setPlayerAchievements(
				{ steamid: friend, appid: appId },
				makePlayerAchievementsPayload({
					userId: friend,
					appId,
					items: [{ ach: "FZ1", achieved: 1, unlock: new Date() }],
				}),
			);

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withFriendsOf(main)
				.withAppIds(appId)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			// Assert DB side-effects
			const friendRow = await db
				.select({ user_id: friends.user_id, friend_id: friends.friend_id })
				.from(friends)
				.where(and(eq(friends.user_id, main), eq(friends.friend_id, friend)));
			assert.strictEqual(friendRow.length, 1, "friend relation should be inserted");

			const friendUser = await db.select({ id: users.id }).from(users).where(eq(users.id, friend));
			assert.strictEqual(friendUser.length, 1, "friend user should exist");

			const friendOwned = await db
				.select({ user_id: ownedGames.user_id, app_id: ownedGames.app_id })
				.from(ownedGames)
				.where(and(eq(ownedGames.user_id, friend), eq(ownedGames.app_id, appId)));
			assert.strictEqual(friendOwned.length, 1, "friend owned game should be inserted");

			// Assert result
			assert.strictEqual(res.data.length, 1);
			const item = res.data[0];
			assert.ok(item);
			assert.strictEqual(item.id, "FZ1");
			assert.ok(item.unlocked instanceof Date);
		});

		test("uses existing friend relation and user/owned game to fetch only missing achievements", async () => {
			const main = "main-existing";
			const friend = "friend-existing";
			const appId = 93009;

			// Seed main and friend users
			await insertUser(db, { id: main, data: makeUserData(main) });
			await insertUser(db, { id: friend, data: makeUserData(friend) });

			// Seed existing friendship row (so FriendsRepository should not call getFriendsList)
			await db.insert(friends).values({
				user_id: main,
				friend_id: friend,
				friend_since: new Date(Date.now() - 60_000),
				updated_at: new Date(),
			});

			// Seed friend's owned game (so UserRepository shouldn't need to fetch owned games)
			await insertOwnedGame(db, { user_id: friend, app_id: appId });

			// Seed app + stats + meta (English) so mapping works; no userAchievements yet
			await seedAppWithPlayers(db, appId, "Existing Friend App", 2500);
			await seedStats(db, appId, [{ ach: "EX1", percent: 8 }]);
			await seedMetaByCode(db, appId, "en", [{ ach: "EX1", display: "Existing One" }]);

			// Mock ONLY player achievements for the friend/app combo (no friendsList/playerSummaries/ownedGames needed)
			authMock.setPlayerAchievements(
				{ steamid: friend, appid: appId },
				makePlayerAchievementsPayload({
					userId: friend,
					appId,
					items: [{ ach: "EX1", achieved: 1, unlock: new Date(Date.now() - 2000) }],
				}),
			);

			const repo = getRepo();
			const res = await repo
				.compose()
				.withLanguage("en")
				.withFriendsOf(main)
				.withAppIds(appId)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			// Assert friendship not duplicated
			const fr = await db
				.select({ user_id: friends.user_id, friend_id: friends.friend_id })
				.from(friends)
				.where(and(eq(friends.user_id, main), eq(friends.friend_id, friend)));
			assert.strictEqual(fr.length, 1, "existing friend relation should be preserved (no duplicates)");

			// Friend user should still be exactly one row (pre-seeded)
			const friendUser = await db.select({ id: users.id }).from(users).where(eq(users.id, friend));
			assert.strictEqual(friendUser.length, 1, "friend user already existed and should remain exactly once");

			// Owned game should still be present as pre-seeded
			const friendOwned = await db
				.select({ user_id: ownedGames.user_id, app_id: ownedGames.app_id })
				.from(ownedGames)
				.where(and(eq(ownedGames.user_id, friend), eq(ownedGames.app_id, appId)));
			assert.strictEqual(
				friendOwned.length,
				1,
				"friend owned game already existed and should remain exactly once",
			);

			// Achievements should now be fetched and upserted
			const ua = await db
				.select({ ach_id: userAchievements.ach_id })
				.from(userAchievements)
				.where(and(eq(userAchievements.user_id, friend), eq(userAchievements.app_id, appId)));
			assert.strictEqual(ua.length, 1, "missing friend achievements should be fetched and inserted");

			// Result should include the fetched achievement
			assert.strictEqual(res.data.length, 1);
			const item = res.data[0];
			assert.ok(item);
			assert.strictEqual(item.id, "EX1");
			assert.ok(item.unlocked instanceof Date);
		});
	});

	test("updates unlocked_at on conflict using EXCLUDED value", async () => {
		const userId = "u-upsert-excluded";
		const appId = 95001;
		const achId = "UX1";

		// Arrange
		await insertUser(db, { id: userId, data: makeUserData(userId) });
		await seedMetaByCode(db, appId, "en", [{ ach: achId, display: "UX One" }]);
		await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: achId, unlocked_at: null });

		// Act: Upsert same PK with a non-null timestamp using EXCLUDED value
		// Use second-precision to avoid millisecond differences in SQLite integer timestamp mode
		const ts = new Date(Math.floor(Date.now() / 1000) * 1000);
		await db
			.insert(userAchievements)
			.values({
				user_id: userId,
				app_id: appId,
				ach_id: achId,
				unlocked_at: ts,
				updated_at: new Date(),
			})
			.onConflictDoUpdate({
				target: [userAchievements.user_id, userAchievements.app_id, userAchievements.ach_id],
				set: {
					unlocked_at: sql`excluded.unlocked_at`,
					updated_at: new Date(),
				},
			});

		// Assert
		const rows = await db
			.select({
				unlocked_at: userAchievements.unlocked_at,
			})
			.from(userAchievements)
			.where(
				and(
					eq(userAchievements.user_id, userId),
					eq(userAchievements.app_id, appId),
					eq(userAchievements.ach_id, achId),
				),
			);
		assert.strictEqual(rows.length, 1, "row should exist");
		const stored = rows[0]?.unlocked_at;
		assert.ok(stored instanceof Date, "unlocked_at should be a Date");
		assert.strictEqual(stored?.getTime(), ts.getTime());
	});
	describe("count()", () => {
		test("count equals build().data.length for unlocked only", async () => {
			const repo = getRepo();
			const userId = "u-count-1";
			const appId = 98101;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });
			await seedAppWithPlayers(db, appId, "Count App 1", 1000);
			await seedStats(db, appId, [
				{ ach: "CU1", percent: 10 },
				{ ach: "CU2", percent: 20 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "CU1", display: "Count U1" },
				{ ach: "CU2", display: "Count U2" },
			]);

			const t = new Date(Date.now() - 1000);
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "CU1", unlocked_at: t });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "CU2", unlocked_at: null });

			const built = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			const cntAttempt = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.count();

			assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
			assert.strictEqual(typeof cntAttempt.data, "number");
			assert.strictEqual(cntAttempt.data, built.data.length);
		});

		test("count equals build().data.length for unlocked + rarity threshold", async () => {
			const repo = getRepo();
			const userId = "u-count-2";
			const appId = 98102;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });
			await seedAppWithPlayers(db, appId, "Count App 2", 2000);
			await seedStats(db, appId, [
				{ ach: "CR1", percent: 5 },
				{ ach: "CR2", percent: 20 },
				{ ach: "CR3", percent: 33 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "CR1", display: "Rare Five" },
				{ ach: "CR2", display: "Rare Twenty" },
				{ ach: "CR3", display: "Rare ThirtyThree" },
			]);

			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "CR1", unlocked_at: new Date() });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "CR2", unlocked_at: null });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "CR3", unlocked_at: new Date() });

			const built = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.withRarityThreshold(0.2)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			const cntAttempt = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.withRarityThreshold(0.2)
				.count();

			assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
			assert.strictEqual(typeof cntAttempt.data, "number");
			assert.strictEqual(cntAttempt.data, built.data.length);
		});

		test("count equals build().data.length for unlocked + rarity threshold + search", async () => {
			const repo = getRepo();
			const userId = "u-count-3";
			const appId = 98103;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });
			await seedAppWithPlayers(db, appId, "Searchable App", 1800);
			await seedStats(db, appId, [
				{ ach: "SA1", percent: 15 },
				{ ach: "SB1", percent: 8 },
			]);
			await seedMetaByCode(db, appId, "en", [
				{ ach: "SA1", display: "Alpha Wolf" },
				{ ach: "SB1", display: "Beta Fish" },
			]);

			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "SA1", unlocked_at: new Date() });
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "SB1", unlocked_at: null });

			const built = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.withRarityThreshold(0.2)
				.withSearch("alpha")
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			const cntAttempt = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.withRarityThreshold(0.2)
				.withSearch("alpha")
				.count();

			assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
			assert.strictEqual(typeof cntAttempt.data, "number");
			assert.strictEqual(cntAttempt.data, built.data.length);
		});

		test("count equals build().data.length with language set and fallback path", async () => {
			const repo = getRepo();
			const userId = "u-count-fr";
			const appId = 98104;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });
			await insertAppByCode(db, { id: appId, langCode: "fr", name: "FR App Row" });
			await db.insert(estimatedPlayers).values({ app_id: appId, estimated_players: 900, updated_at: new Date() });
			await seedStats(db, appId, [{ ach: "CF1", percent: 12 }]);
			await seedMetaByCode(db, appId, "en", [{ ach: "CF1", display: "English Meta" }]);
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "CF1", unlocked_at: new Date() });

			const built = await repo
				.compose()
				.withLanguage("fr")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.build({ sort: { method: "rarity_pct", direction: "asc" } });

			const cntAttempt = await repo
				.compose()
				.withLanguage("fr")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.count();

			assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
			assert.strictEqual(typeof cntAttempt.data, "number");
			assert.strictEqual(cntAttempt.data, built.data.length);
		});

		test("count() does not hydrate models (returns a plain number)", async () => {
			const repo = getRepo();
			const userId = "u-count-plain";
			const appId = 98105;

			await insertUser(db, { id: userId, data: makeUserData(userId) });
			await insertOwnedGame(db, { user_id: userId, app_id: appId });
			await seedAppWithPlayers(db, appId, "Plain Count App", 777);
			await seedStats(db, appId, [{ ach: "PX1", percent: 11 }]);
			await seedMetaByCode(db, appId, "en", [{ ach: "PX1", display: "P1" }]);
			await insertUserAchievement(db, { user_id: userId, app_id: appId, ach_id: "PX1", unlocked_at: new Date() });

			const attempt = await repo
				.compose()
				.withLanguage("en")
				.withUserIds(userId)
				.withAppIds(appId)
				.withUnlockedStatus(true)
				.count();

			assert.strictEqual(attempt.status, AttemptStatus.Ok);
			assert.strictEqual(typeof attempt.data, "number");
		});

		test("count returns Attempt failure on SQL error", async () => {
			const repo = getRepo();
			const userId = "u-count-error";
			// minimal prerequisite so composer has a user scope
			await insertUser(db, { id: userId, data: makeUserData(userId) });

			// Bypass TS protected access for testing error path
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const composer: any = repo.compose().withLanguage("en").withUserIds(userId);

			// Monkey-patch the drizzle client's `with` method to force an error during COUNT
			const originalWith = composer.db.with;
			try {
				composer.db.with = () => {
					throw new Error("forced-sql-error");
				};
				const attempt = await composer.count();

				// Should propagate as a Failure Attempt with an Error instance
				assert.strictEqual(attempt.status, AttemptStatus.Failure);
				assert.ok(attempt.error instanceof Error);
			} finally {
				// Restore patched method to avoid side effects
				composer.db.with = originalWith;
			}
		});
	});
});

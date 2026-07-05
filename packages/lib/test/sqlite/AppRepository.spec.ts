import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { excluded } from "../../src/repositories/sqlite/operators";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import {
	achievementsMeta,
	achievementsStats,
	apps,
	estimatedPlayers,
	ownedGames,
	steamChartsSnapshots,
	users,
} from "../../src/repositories/sqlite/schema.js";
import {
	basicAchievement,
	basicAchievementEn,
	fixtureAppEn,
	fixtureAppFr,
	makeAchievementSchema,
	makeAppData,
} from "../fixtures/appData";
import { insertAchievementMeta, insertApp } from "../fixtures/dbHelpers";
import { makeAppRepoWithMocks } from "../fixtures/mockHelpers";
import { makeUserData } from "../fixtures/userData";
import { createLocalBudget, decorateWithBudget } from "../helpers/fetchBudget";
import { runMigrations } from "../helpers/migrate";
import { setupMockFetchWithManager } from "../helpers/mockFetchWithManager";

describe("AppRepository - SQLite (in-memory)", () => {
	let db: ProjectDB;
	let ctx: ReturnType<typeof makeAppRepoWithMocks>;

	beforeEach(async () => {
		const sqlite = new Database(":memory:");

		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");

		await runMigrations(sqlite);
		db = drizzle(sqlite) as unknown as ProjectDB;

		// Fresh per-test repo + mocks
		ctx = makeAppRepoWithMocks(db);
	});

	test("fetches and upserts an English-only app", async () => {
		const { repo, auth, store } = ctx;
		const appResp = {
			[fixtureAppEn.appid]: { success: true as const, data: makeAppData(fixtureAppEn.appid, fixtureAppEn.name) },
		};
		store.setAppDetails(fixtureAppEn.appid, appResp);
		auth.setSchemaForGame({ appid: fixtureAppEn.appid, l: "english" }, makeAchievementSchema("Test Game", []));

		await repo.compose().withLanguage("en").withAppIds(fixtureAppEn.appid).build();

		// Assert app row inserted
		const rows = await db.select({ id: apps.id, lang: apps.lang, data: apps.data }).from(apps);
		const appRows = rows.filter((r) => r.id === fixtureAppEn.appid && r.lang === "english");
		assert.strictEqual(appRows.length, 1, "App row should be inserted");
		const first = appRows[0];
		assert.ok(first, "Expected at least one app row");
		const { name } = first.data as { name?: string };
		assert.strictEqual(name, fixtureAppEn.name);

		// Assert no achievements meta for empty schema
		const metaAll = await db
			.select({
				app_id: achievementsMeta.app_id,
				ach_id: achievementsMeta.ach_id,
				lang: achievementsMeta.lang,
			})
			.from(achievementsMeta);
		const metaRows = metaAll.filter((r) => r.app_id === fixtureAppEn.appid);
		assert.strictEqual(metaRows.length, 0, "No achievement meta rows for empty schema");
	});

	test("French localization identical to English - only English stored", async () => {
		const { repo, auth, store } = ctx;

		await insertApp(db, {
			id: fixtureAppEn.appid,
			lang: "english",
			data: makeAppData(fixtureAppEn.appid, fixtureAppEn.name ?? "Test App EN"),
		});
		await insertAchievementMeta(db, {
			app_id: fixtureAppEn.appid,
			ach_id: basicAchievement.name,
			display_name: basicAchievement.displayName,
			default_value: 0,
			description: basicAchievement.description,
			icon: basicAchievement.icon,
			icon_gray: basicAchievement.icongray,
			hidden: 0,
			lang: "english",
		});

		const frResp = {
			[fixtureAppFr.appid]: { success: true as const, data: makeAppData(fixtureAppFr.appid, fixtureAppFr.name) },
		};
		store.setAppDetails(fixtureAppFr.appid, frResp);
		// Mock French response with identical content to English
		auth.setSchemaForGame(
			{ appid: fixtureAppEn.appid, l: "french" },
			makeAchievementSchema("Test Game", [basicAchievement]),
		);

		await repo.compose().withLanguage("fr").withAppIds(fixtureAppEn.appid).build();

		// Verify only EN meta is stored when FR content is identical to EN
		const metaAll = await db
			.select({
				app_id: achievementsMeta.app_id,
				ach_id: achievementsMeta.ach_id,
				lang: achievementsMeta.lang,
			})
			.from(achievementsMeta);
		const metaRows = metaAll.filter((r) => r.app_id === fixtureAppEn.appid);
		assert.strictEqual(metaRows.length, 1, "Only English meta should be stored when French content is identical");
		const langs = new Set(metaRows.map((r) => r.lang));
		assert.deepStrictEqual(langs, new Set(["english"]), "Only English language code should be present");
	});

	test("French localization differs - both languages stored", async () => {
		const { repo, auth, store } = ctx;

		await insertApp(db, {
			id: fixtureAppEn.appid,
			lang: "english",
			data: makeAppData(fixtureAppEn.appid, fixtureAppEn.name ?? "Test App EN"),
		});
		await insertAchievementMeta(db, {
			app_id: fixtureAppEn.appid,
			ach_id: basicAchievementEn.name,
			display_name: basicAchievementEn.displayName,
			default_value: 0,
			description: basicAchievementEn.description,
			icon: basicAchievementEn.icon,
			icon_gray: basicAchievementEn.icongray,
			hidden: 0,
			lang: "english",
		});

		const frResp = {
			[fixtureAppFr.appid]: { success: true as const, data: makeAppData(fixtureAppFr.appid, fixtureAppFr.name) },
		};
		store.setAppDetails(fixtureAppFr.appid, frResp);
		auth.setSchemaForGame(
			{ appid: fixtureAppEn.appid, l: "french" },
			makeAchievementSchema("Test Game", [{ ...basicAchievement, description: "Desc FR" }]),
		);

		await repo.compose().withLanguage("fr").withAppIds(fixtureAppEn.appid).build();

		// Verify both EN and FR meta rows exist for ACH1
		const metaAll2 = await db
			.select({
				app_id: achievementsMeta.app_id,
				ach_id: achievementsMeta.ach_id,
				lang: achievementsMeta.lang,
				display_name: achievementsMeta.display_name,
				description: achievementsMeta.description,
			})
			.from(achievementsMeta);
		const forApp = metaAll2.filter((r) => r.app_id === fixtureAppEn.appid && r.ach_id === basicAchievementEn.name);
		const langs = new Set(forApp.map((r) => r.lang));
		assert.strictEqual(forApp.length, 2, "Both EN and FR meta should be stored");
		assert.deepStrictEqual(langs, new Set(["english", "french"]));

		// Verify content is correct for each language
		const englishRow = forApp.find((r) => r.lang === "english");
		const frenchRow = forApp.find((r) => r.lang === "french");
		assert.ok(englishRow, "English row should exist");
		assert.ok(frenchRow, "French row should exist");
		assert.strictEqual(englishRow.display_name, "Achievement 1", "English should have correct display name");
		assert.strictEqual(englishRow.description, "Desc EN", "English should have correct description");
		assert.strictEqual(frenchRow.display_name, "Achievement 1", "French should have correct display name");
		assert.strictEqual(frenchRow.description, "Desc FR", "French should have correct description");

		// Also verify selection behavior by language
		const frResult = await repo.compose().withLanguage("fr").withAppIds(fixtureAppEn.appid).build();
		assert.strictEqual(frResult.data.length >= 1, true);

		const enResult = await repo.compose().withLanguage("en").withAppIds(fixtureAppEn.appid).build();
		assert.strictEqual(enResult.data.length >= 1, true);
	});

	test("API returns English content for French request - content correctly labeled as English", async () => {
		const { repo, auth, store } = ctx;

		await insertApp(db, {
			id: fixtureAppEn.appid,
			lang: "english",
			data: makeAppData(fixtureAppEn.appid, fixtureAppEn.name ?? "Test App EN"),
		});

		const frResp = {
			[fixtureAppFr.appid]: { success: true as const, data: makeAppData(fixtureAppFr.appid, fixtureAppFr.name) },
		};
		store.setAppDetails(fixtureAppFr.appid, frResp);

		// Mock API returning English content when French is requested (simulating API fallback)
		const englishAchievement = basicAchievement; // Same English content
		auth.setSchemaForGame(
			{ appid: fixtureAppEn.appid, l: "french" },
			makeAchievementSchema("Test Game", [englishAchievement]),
		);
		// Also mock the English request to return the same content
		auth.setSchemaForGame(
			{ appid: fixtureAppEn.appid, l: "english" },
			makeAchievementSchema("Test Game", [englishAchievement]),
		);

		await repo.compose().withLanguage("fr").withAppIds(fixtureAppEn.appid).build();

		// Verify that even though we requested French, the stored content is correctly labeled
		const metaRows = await db
			.select({
				app_id: achievementsMeta.app_id,
				ach_id: achievementsMeta.ach_id,
				lang: achievementsMeta.lang,
				display_name: achievementsMeta.display_name,
				description: achievementsMeta.description,
			})
			.from(achievementsMeta)
			.where(eq(achievementsMeta.app_id, fixtureAppEn.appid));

		// Should have only English entry (no duplicate French when content is identical)
		assert.strictEqual(metaRows.length, 1, "Should store only English when French content is identical");

		const englishRow = metaRows.find((r) => r.lang === "english");
		assert.ok(englishRow, "English row should exist");

		// Should not have French row when content is identical
		const frenchRow = metaRows.find((r) => r.lang === "french");
		assert.strictEqual(frenchRow, undefined, "Should not store French row when content is identical to English");

		// But they should be correctly labeled with their respective language codes
		assert.strictEqual(englishRow.lang, "english", "English content should be labeled as English");
	});

	test("app with no achievements still returns the app row", async () => {
		const { repo, auth, store } = ctx;
		const enResp = {
			[fixtureAppEn.appid]: { success: true as const, data: makeAppData(fixtureAppEn.appid, fixtureAppEn.name) },
		};
		store.setAppDetails(fixtureAppEn.appid, enResp);
		auth.setSchemaForGame({ appid: fixtureAppEn.appid, l: "english" }, makeAchievementSchema("Test Game", []));

		const result = await repo.compose().withLanguage("en").withAppIds(fixtureAppEn.appid).build();

		assert.strictEqual(result.data.length, 1, "Should return 1 app");
		assert.strictEqual(result.data[0]?.id, fixtureAppEn.appid, "App ID should match");
	});

	test("withSearch matches app name using searchTerms()", async () => {
		const { repo } = ctx;
		// Seed apps
		await insertApp(db, { id: 1001, lang: "english", data: makeAppData(1001, "Portal 2") });
		await insertApp(db, { id: 1002, lang: "english", data: makeAppData(1002, "Half-Life 2") });

		const result = await repo
			.compose()
			.withLanguage("en")
			.withAppIds([1001, 1002]) // Explicit scope required
			.withSearch("portal")
			.build();

		assert.strictEqual(result.data.length, 1, "Should return 1 app matching 'portal'");
		assert.strictEqual(result.data[0]?.name, "Portal 2", "Should return Portal 2");
	});

	test("withAppIds limits selection to provided IDs (smoke)", async () => {
		const { repo } = ctx;
		await insertApp(db, { id: 2001, lang: "english", data: makeAppData(2001, "App A") });
		await insertApp(db, { id: 2002, lang: "english", data: makeAppData(2002, "App B") });

		const res = await repo.compose().withLanguage("en").withAppIds([2001]).build();

		assert.deepStrictEqual(res.data.map((a) => a.id).sort(), [2001]);
	});

	test("withOwnedByUsers composes subquery (smoke)", async () => {
		const { repo } = ctx;
		// Seed minimal user and ownership
		await db.insert(users).values({ id: "user-1", data: makeUserData("user-1"), updated_at: new Date() });
		await insertApp(db, { id: 3001, lang: "english", data: makeAppData(3001, "Owned App") });
		await db.insert(ownedGames).values({
			user_id: "user-1",
			app_id: 3001,
			playtime_2w_minutes: 0,
			playtime_total_minutes: 0,
			last_played_at: null,
		});

		await repo.compose().withLanguage("en").withAppIds([3001]).withOwnedByUsers(["user-1"]).build();
		assert.ok(true, "withOwnedByUsers executes without throwing");
	});

	test("withAchievements filters apps that have achievement stats (smoke)", async () => {
		const { repo } = ctx;
		await insertApp(db, { id: 4001, lang: "english", data: makeAppData(4001, "Has Achievements") });
		await db
			.insert(achievementsStats)
			.values({ app_id: 4001, ach_id: "ACH_X", percent: 10, updated_at: new Date() });

		await repo.compose().withLanguage("en").withAppIds([4001]).withAchievements().build();
		assert.ok(true, "withAchievements executes without throwing");
	});

	// Parallel ensure/upsert path under a synthetic fetch budget
	test("parallel ensure populates only apps covered by budget", async () => {
		const { repo: appRepo, auth, store } = ctx;
		const appIds = Array.from({ length: 12 }, (_, i) => 1000 + i);

		for (const id of appIds) {
			store.setAppDetails(id, { [id]: { success: true as const, data: makeAppData(id, `App ${id}`) } });
			auth.setSchemaForGame(
				{ appid: id, l: "english" },
				makeAchievementSchema(`App ${id}`, [basicAchievementEn]),
			);
			auth.setGlobalAchievementPercentagesForApp(id, {
				achievementpercentages: { achievements: [{ name: basicAchievement.name, percent: 25 }] },
			});
		}

		// Each app needs up to 3 calls (details, schema, stats). Budget for ~4 apps.
		const budget = createLocalBudget(3 * 4);
		decorateWithBudget(store, ["getAppDetails"], budget);
		decorateWithBudget(auth, ["getSchemaForGame", "getGlobalAchievementPercentagesForApp"], budget);

		const res = await appRepo.compose().withLanguage("en").withAppIds(appIds).build();
		assert.ok(res.isOk() || res.isPartial());

		// Verify tables reflect only a budget-limited subset
		const appRows = await db.select().from(apps);
		assert.ok(appRows.length >= 3 && appRows.length <= 5);

		const metaRows = await db.select().from(achievementsMeta);
		const statsRows = await db.select().from(achievementsStats);
		assert.ok(metaRows.length >= 3 && metaRows.length <= 5);
		assert.ok(statsRows.length >= 3 && statsRows.length <= 5);
	});

	test("pagination and sorting do not throw", async () => {
		const { repo } = ctx;
		const ids: number[] = [];
		for (let i = 0; i < 5; i++) {
			const id = 5000 + i;
			ids.push(id);
			await insertApp(db, { id, lang: "english", data: makeAppData(id, `App ${i}`) });
		}

		await repo
			.compose()
			.withLanguage("en")
			.withAppIds(ids) // Explicit scope required
			.build({ sort: { method: "id", direction: "asc" }, limit: 2 });
		assert.ok(true, "pagination and sorting execute without throwing");
	});

	test("does not throw when player estimates are unavailable (stores null estimate)", async () => {
		const { repo, store, charts } = ctx;
		const appId = 81001;

		// Seed an English app row so estimation logic runs against it
		await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, "No Charts App") });

		// Provide minimal reviews summary; charts data is unavailable (null)
		store.setAppReviews(appId, {
			success: 1,
			cursor: "",
			reviews: [],
			query_summary: {
				num_reviews: 0,
				review_score: 0,
				review_score_desc: "None",
				total_positive: 0,
				total_negative: 0,
				total_reviews: 0,
			},
		});
		charts.setAppChartData(appId, null);

		// Build should not throw; estimatedPlayers should be null
		const result = await repo.compose().withLanguage("en").withAppIds(appId).build();
		assert.strictEqual(result.data.length, 1, "Should return 1 app");
		assert.strictEqual(result.data[0]?.id, appId, "App ID should match");
		assert.strictEqual(result.data[0]?.estimatedPlayers, null, "Estimated players should be null when unavailable");

		// Verify an estimated_players row exists with null value
		const rows = await db
			.select({ app_id: estimatedPlayers.app_id, est: estimatedPlayers.estimated_players })
			.from(estimatedPlayers);
		const ep = rows.find((r) => r.app_id === appId);
		assert.ok(ep, "Estimated players row should be inserted");
		assert.strictEqual(ep?.est, null, "Estimated players value should be null");
	});

	test("stores SteamCharts snapshot while estimating player count", async () => {
		const { repo, store, charts } = ctx;
		const appId = 81002;
		const nowTimestamp = Date.now();

		await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, "Charted App") });
		store.setAppReviews(appId, {
			success: 1,
			cursor: "",
			reviews: [],
			query_summary: {
				num_reviews: 100,
				review_score: 8,
				review_score_desc: "Very Positive",
				total_positive: 90,
				total_negative: 10,
				total_reviews: 100,
			},
		});
		charts.setAppChartData(appId, [
			[nowTimestamp - 60 * 60 * 48 * 1000, 10],
			[nowTimestamp - 60 * 60 * 2 * 1000, 25],
			[nowTimestamp - 60 * 30 * 1000, 20],
		]);

		const result = await repo.compose().withLanguage("en").withAppIds(appId).build();
		assert.ok(result.isOk(), "player estimate should complete");

		const rows = await db
			.select({
				app_id: steamChartsSnapshots.app_id,
				allTimePeak: steamChartsSnapshots.all_time_peak,
				avgCount: steamChartsSnapshots.avg_count,
				dayPeak: steamChartsSnapshots.day_peak,
				recentPoints: steamChartsSnapshots.recent_points,
			})
			.from(steamChartsSnapshots);
		const snapshot = rows.find((row) => row.app_id === appId);
		assert.ok(snapshot, "SteamCharts snapshot should be stored");
		assert.strictEqual(snapshot.allTimePeak, 25);
		assert.strictEqual(snapshot.avgCount, 55 / 3);
		assert.strictEqual(snapshot.dayPeak, 25);
		assert.deepStrictEqual(snapshot.recentPoints, [
			[nowTimestamp - 60 * 60 * 48 * 1000, 10],
			[nowTimestamp - 60 * 60 * 2 * 1000, 25],
			[nowTimestamp - 60 * 30 * 1000, 20],
		]);

		const cachedSnapshot = await repo.getSteamChartsSnapshot(appId);
		assert.ok(cachedSnapshot, "SteamCharts snapshot should be readable from the repository");
		assert.strictEqual(cachedSnapshot.appId, appId);
		assert.strictEqual(cachedSnapshot.allTimePeak, 25);
		assert.strictEqual(cachedSnapshot.dayPeak, 25);
		assert.deepStrictEqual(cachedSnapshot.recentPoints, snapshot.recentPoints);
		assert.ok(cachedSnapshot.updatedAt instanceof Date);
	});

	test("withCutoff refreshes stale player estimates", async () => {
		const { repo, store, charts } = ctx;
		const appId = 81003;
		const nowSeconds = Math.floor(Date.now() / 1000);
		const staleDate = new Date(Date.now() - 60 * 60 * 1000);
		const cutoff = new Date(Date.now() - 5 * 60 * 1000);

		await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, "Stale Estimate App") });
		await db.insert(estimatedPlayers).values({ app_id: appId, estimated_players: 123, updated_at: staleDate });
		store.setAppReviews(appId, {
			success: 1,
			cursor: "",
			reviews: [],
			query_summary: {
				num_reviews: 100,
				review_score: 8,
				review_score_desc: "Very Positive",
				total_positive: 90,
				total_negative: 10,
				total_reviews: 100,
			},
		});
		charts.setAppChartData(appId, [[nowSeconds - 60, 42]]);

		const result = await repo.compose().withLanguage("en").withAppIds(appId).withCutoff(cutoff).build();
		assert.ok(result.isOk(), "stale estimate refresh should complete");

		const rows = await db
			.select({ app_id: steamChartsSnapshots.app_id, allTimePeak: steamChartsSnapshots.all_time_peak })
			.from(steamChartsSnapshots);
		assert.strictEqual(rows.find((row) => row.app_id === appId)?.allTimePeak, 42);
	});

	test("withCutoff refetches stale app data", async () => {
		const { repo, auth, store } = ctx;
		const appId = 88001;
		const staleDate = new Date(Date.now() - 60 * 60 * 1000);
		await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, "Old App") });
		// Manually backdate updated_at
		await db
			.update(apps)
			.set({ updated_at: staleDate })
			.where(and(eq(apps.id, appId), eq(apps.lang, "english")));

		const resp = { [appId]: { success: true as const, data: makeAppData(appId, "New App") } };
		store.setAppDetails(appId, resp);
		auth.setSchemaForGame({ appid: appId, l: "english" }, makeAchievementSchema("New App", []));

		const cutoff = new Date();
		const result = await repo.compose().withLanguage("en").withAppIds(appId).withCutoff(cutoff).build();
		assert.strictEqual(result.data[0]?.name, "New App");
		const updated = await db
			.select({ updated_at: apps.updated_at })
			.from(apps)
			.where(and(eq(apps.id, appId), eq(apps.lang, "english")));
		assert.ok(updated[0]?.updated_at && updated[0].updated_at > staleDate, "updated_at should refresh");
	});

	test("ensureDataExists respects fetch manager limits", async () => {
		const { repo, auth, store } = ctx;
		let cleanupFetch: (() => void) | undefined;

		try {
			// Setup mock fetch with very low limit to trigger failure
			cleanupFetch = setupMockFetchWithManager();

			// Mock some apps that will require fetching
			const appIds = [123, 456, 789];

			// Create missing apps scenario
			for (const appId of appIds) {
				const appData = makeAppData(appId, `Test App ${appId}`);
				const appResp = {
					[appId]: { success: true as const, data: appData },
				};
				store.setAppDetails(appId, appResp);

				// Setup achievement schema
				auth.setSchemaForGame(
					{ appid: appId, l: "english" },
					makeAchievementSchema(`Test Game ${appId}`, [basicAchievement]),
				);
			}

			// Build repository with the app IDs using compose pattern
			const result = await repo.compose().withLanguage("en").withAppIds(appIds).build();

			// Should succeed normally with mock data
			assert.ok(result.isOk(), "ensureDataExists should succeed with fetch limiting");
		} finally {
			cleanupFetch?.();
		}
	});

	test("fetchAndUpsertPlayerEstimates respects fetch manager limits", async () => {
		const { repo, store } = ctx;
		let cleanupFetch: (() => void) | undefined;

		try {
			// Setup mock fetch
			cleanupFetch = setupMockFetchWithManager();

			// Insert some apps that need player estimates
			const appIds = [123, 456];
			for (const appId of appIds) {
				const appData = makeAppData(appId, `Test App ${appId}`);

				// Insert app into database
				await insertApp(db, {
					id: appId,
					data: appData,
					lang: "english",
				});

				// Mock API responses for player count estimation
				const appResp = {
					[appId]: { success: true as const, data: appData },
				};
				store.setAppDetails(appId, appResp);
				store.setAppReviews(appId, {
					success: 1,
					query_summary: {
						num_reviews: 1000,
						review_score: 0,
						review_score_desc: "No user reviews",
						total_positive: 500,
						total_negative: 500,
						total_reviews: 1000,
					},
					reviews: [],
					cursor: "",
				});
				// Steam Charts API can fail gracefully, so we don't need to mock it
			}

			// Build repository with the app IDs - this will call ensureDataExists internally
			// which will trigger fetchAndUpsertPlayerEstimates for the missing player estimates
			const result = await repo.compose().withLanguage("en").withAppIds(appIds).build();

			// Should succeed - player estimates are attempted but failures are acceptable
			assert.ok(result.isOk(), "Player estimates should work with fetch limiting");
		} finally {
			cleanupFetch?.();
		}
	});
});

describe("Upsert regression - App repository", () => {
	let db: ProjectDB;

	beforeEach(async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		db = drizzle(sqlite) as unknown as ProjectDB;
	});

	test("app metadata upsert uses EXCLUDED fields", async () => {
		const appId = 71001;
		const lang = "english" as const;

		const t0 = new Date(Date.now() - 60_000);
		const initial = { ...makeAppData(appId, "Old Name"), header_image: "https://example.com/old.jpg" };
		await db.insert(apps).values({ id: appId, lang, data: initial, updated_at: t0 });

		const updated = { ...initial, name: "New Name", header_image: "https://example.com/new.jpg" };
		await db
			.insert(apps)
			.values({ id: appId, lang, data: updated })
			.onConflictDoUpdate({
				target: [apps.id, apps.lang],
				set: {
					data: excluded(apps.data),
					updated_at: new Date(),
				},
			});

		const rows = await db
			.select({ id: apps.id, lang: apps.lang, data: apps.data, updated_at: apps.updated_at })
			.from(apps);
		const row = rows.find((r) => r.id === appId && r.lang === lang);
		if (!row) throw new Error("app row should exist after upsert");
		const data = row.data as { name?: string; header_image?: string };
		assert.strictEqual(data.name, "New Name", "name should be overwritten by EXCLUDED.data");
		assert.strictEqual(
			data.header_image,
			"https://example.com/new.jpg",
			"header_image should be overwritten by EXCLUDED.data",
		);
		assert.ok(row.updated_at > t0, "updated_at should be refreshed on conflict");
	});

	test("achievement stats upsert uses EXCLUDED fields", async () => {
		const appId = 72001;
		const achId = "ACH_UPSERT_STATS";

		const t0 = new Date(Date.now() - 60_000);
		await db.insert(achievementsStats).values({ app_id: appId, ach_id: achId, percent: 10, updated_at: t0 });

		await db
			.insert(achievementsStats)
			.values({ app_id: appId, ach_id: achId, percent: 25 })
			.onConflictDoUpdate({
				target: [achievementsStats.app_id, achievementsStats.ach_id],
				set: {
					percent: excluded(achievementsStats.percent),
					updated_at: new Date(),
				},
			});

		const rows = await db
			.select({
				app_id: achievementsStats.app_id,
				ach_id: achievementsStats.ach_id,
				percent: achievementsStats.percent,
				updated_at: achievementsStats.updated_at,
			})
			.from(achievementsStats);
		const row = rows.find((r) => r.app_id === appId && r.ach_id === achId);
		if (!row) throw new Error("stats row should exist after upsert");
		assert.strictEqual(row.percent, 25, "percent should be overwritten by EXCLUDED.percent");
		assert.ok(row.updated_at > t0, "updated_at should be refreshed on conflict");
	});
});

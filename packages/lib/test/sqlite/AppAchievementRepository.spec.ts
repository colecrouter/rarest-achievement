import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AttemptStatus } from "../../src/error";
import { AppAchievementRepository } from "../../src/repositories/sqlite/AppAchievement";
import { excluded } from "../../src/repositories/sqlite/operators";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { achievementsMeta, achievementsStats, apps, estimatedPlayers } from "../../src/repositories/sqlite/schema.js";
import { seedAppWithPlayers, seedMetaByCode, seedStats } from "../fixtures/appAchievementsData";
import { basicAchievement, makeAchievementSchema, makeAppData } from "../fixtures/appData";
import { makeAppRepoWithMocks } from "../fixtures/mockHelpers";
import { runMigrations } from "../helpers/migrate";

describe("AppAchievementRepository - upsert regression (sqlite)", () => {
	let db: ProjectDB;

	beforeEach(async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		db = drizzle(sqlite) as unknown as ProjectDB;
	});

	test("achievements meta upsert uses EXCLUDED fields", async () => {
		const appId = 81001;
		const achId = "ACH_META_UPSERT";
		const lang = "english" as const;

		// Seed initial row
		await db.insert(achievementsMeta).values({
			app_id: appId,
			ach_id: achId,
			lang,
			display_name: "Old Name",
			default_value: 0,
			description: "Old Desc",
			icon: "old.png",
			icon_gray: "old-gray.png",
			hidden: 0,
		});

		// Upsert with changed fields using the same conflict target and EXCLUDED-set as production
		await db
			.insert(achievementsMeta)
			.values({
				app_id: appId,
				ach_id: achId,
				lang,
				display_name: "New Name",
				default_value: 5,
				description: "New Desc",
				icon: "new.png",
				icon_gray: "new-gray.png",
				hidden: 1,
			})
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
			});

		const rows = await db
			.select({
				app_id: achievementsMeta.app_id,
				ach_id: achievementsMeta.ach_id,
				lang: achievementsMeta.lang,
				display_name: achievementsMeta.display_name,
				default_value: achievementsMeta.default_value,
				description: achievementsMeta.description,
				icon: achievementsMeta.icon,
				icon_gray: achievementsMeta.icon_gray,
				hidden: achievementsMeta.hidden,
			})
			.from(achievementsMeta);

		const row = rows.find((r) => r.app_id === appId && r.ach_id === achId && r.lang === lang);
		if (!row) throw new Error("achievement meta row should exist after upsert");

		assert.strictEqual(row.display_name, "New Name");
		assert.strictEqual(row.default_value, 5);
		assert.strictEqual(row.description, "New Desc");
		assert.strictEqual(row.icon, "new.png");
		assert.strictEqual(row.icon_gray, "new-gray.png");
		assert.strictEqual(row.hidden, 1);
	});

	test("rarity_score sort omits achievements for apps without estimated players", async () => {
		// Set up App and AppAchievement repos with mocks
		const { repo: appRepo, auth, store } = makeAppRepoWithMocks(db);
		const appAchRepo = new AppAchievementRepository(db, appRepo);

		const appA = 88011;
		const appB = 88012;

		// Provide app details and schema so AppRepository can upsert app + meta
		store.setAppDetails(appA, { [appA]: { success: true as const, data: makeAppData(appA, "A") } });
		store.setAppDetails(appB, { [appB]: { success: true as const, data: makeAppData(appB, "B") } });
		auth.setSchemaForGame({ appid: appA, l: "english" }, makeAchievementSchema("A", [basicAchievement]));
		auth.setSchemaForGame({ appid: appB, l: "english" }, makeAchievementSchema("B", [basicAchievement]));

		// Build via AppRepository to ensure app + meta rows exist
		await appRepo.compose().withLanguage("en").withAppIds([appA, appB]).build();

		// Stats for both apps
		await db
			.insert(achievementsStats)
			.values({ app_id: appA, ach_id: basicAchievement.name, percent: 10, updated_at: new Date() });
		await db
			.insert(achievementsStats)
			.values({ app_id: appB, ach_id: basicAchievement.name, percent: 20, updated_at: new Date() });

		// Estimated players only for appA (use upsert to tolerate pre-existing null rows from ensure)
		await db
			.insert(estimatedPlayers)
			.values({ app_id: appA, estimated_players: 1000, updated_at: new Date() })
			.onConflictDoUpdate({
				target: estimatedPlayers.app_id,
				set: {
					estimated_players: excluded(estimatedPlayers.estimated_players),
					updated_at: new Date(),
				},
			});

		const res = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appA, appB])
			.build({ sort: { method: "rarity_score", direction: "desc" } });

		assert.strictEqual(res.data.length, 1);
		assert.strictEqual(res.data[0]?.app.id, appA);
	});

	test("rarity_score excludes zero/negative estimated players (AppAchievement)", async () => {
		const { repo: appRepo, auth, store } = makeAppRepoWithMocks(db);
		const appAchRepo = new AppAchievementRepository(db, appRepo);

		const appPos = 88021;
		const appZero = 88022;
		const appNeg = 88023;

		// Provide app details and schema so AppRepository can upsert app + meta
		for (const id of [appPos, appZero, appNeg]) {
			store.setAppDetails(id, { [id]: { success: true as const, data: makeAppData(id, String(id)) } });
			auth.setSchemaForGame({ appid: id, l: "english" }, makeAchievementSchema(String(id), [basicAchievement]));
		}

		// Build via AppRepository to ensure app + meta rows exist
		await appRepo.compose().withLanguage("en").withAppIds([appPos, appZero, appNeg]).build();

		// Stats for all apps
		for (const id of [appPos, appZero, appNeg]) {
			await db
				.insert(achievementsStats)
				.values({ app_id: id, ach_id: basicAchievement.name, percent: 10, updated_at: new Date() });
		}

		// Estimated players: positive, zero, negative (use upsert to tolerate pre-existing rows)
		for (const [appId, est] of [
			[appPos, 1000],
			[appZero, 0],
			[appNeg, -5],
		] as const) {
			await db
				.insert(estimatedPlayers)
				.values({ app_id: appId, estimated_players: est, updated_at: new Date() })
				.onConflictDoUpdate({
					target: estimatedPlayers.app_id,
					set: {
						estimated_players: excluded(estimatedPlayers.estimated_players),
						updated_at: new Date(),
					},
				});
		}

		const res = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appPos, appZero, appNeg])
			.build({ sort: { method: "rarity_score", direction: "desc" } });

		// Only positive should remain
		if (!res.data) throw new Error("expected data");
		assert.strictEqual(res.data.length, 1);
		assert.strictEqual(res.data[0]?.app.id, appPos);
	});

	test("withCutoff propagates to AppRepository and refetches stale app data", async () => {
		const { repo: appRepo, auth, store } = makeAppRepoWithMocks(db);
		const appAchRepo = new AppAchievementRepository(db, appRepo);
		const appId = 88111;
		// Seed stale app + achievement stats (old updated_at)
		await db.insert(achievementsStats).values({
			app_id: appId,
			ach_id: basicAchievement.name,
			percent: 10,
			updated_at: new Date(Date.now() - 3600_000),
		});
		// Initial app row with old name
		await db.insert(achievementsMeta).values({
			app_id: appId,
			ach_id: basicAchievement.name,
			lang: "english",
			display_name: basicAchievement.displayName,
			default_value: 0,
			description: basicAchievement.description,
			icon: basicAchievement.icon,
			icon_gray: basicAchievement.icongray,
			hidden: 0,
		});
		// Seed app row manually (old name) and backdate using ORM (avoids raw Date binding issues)
		const staleDate = new Date(Date.now() - 3600_000);
		await db
			.insert(apps)
			.values({ id: appId, data: makeAppData(appId, "Old Name"), lang: "english", updated_at: staleDate });
		// Mock API returns new name
		store.setAppDetails(appId, { [appId]: { success: true as const, data: makeAppData(appId, "Fresh Name") } });
		auth.setSchemaForGame({ appid: appId, l: "english" }, makeAchievementSchema("Fresh Name", [basicAchievement]));

		const res = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appId])
			.withCutoff(new Date())
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		assert.strictEqual(res.data.length, 1);
		assert.strictEqual(res.data[0]?.app.name, "Fresh Name", "Stale app data should be refetched through cutoff");
	});
});

describe("AppAchievementRepository - count()", () => {
	let db: ProjectDB;

	beforeEach(async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec("PRAGMA case_sensitive_like = ON;");
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA synchronous = NORMAL;");
		await runMigrations(sqlite);
		db = drizzle(sqlite) as unknown as ProjectDB;
	});

	test("count equals build().data.length with appIds and language", async () => {
		const { repo: appRepo } = makeAppRepoWithMocks(db);
		const appAchRepo = new AppAchievementRepository(db, appRepo);

		const appId = 99001;
		await seedAppWithPlayers(db, appId, "Count App", 1234);
		await seedStats(db, appId, [
			{ ach: "C1", percent: 10 },
			{ ach: "C2", percent: 20 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "C1", display: "Alpha One" },
			{ ach: "C2", display: "Beta Two" },
		]);

		const built = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appId])
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		const cntAttempt = await appAchRepo.compose().withLanguage("en").withAppIds([appId]).count();

		assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
		assert.strictEqual(typeof cntAttempt.data, "number");
		assert.strictEqual(cntAttempt.data, built.data.length);
	});

	test("count equals build().data.length with withRarityThreshold", async () => {
		const { repo: appRepo } = makeAppRepoWithMocks(db);
		const appAchRepo = new AppAchievementRepository(db, appRepo);

		const appId = 99002;
		await seedAppWithPlayers(db, appId, "Rarity App", 2000);
		await seedStats(db, appId, [
			{ ach: "R1", percent: 5 },
			{ ach: "R2", percent: 20 },
			{ ach: "R3", percent: 33 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "R1", display: "Rare One" },
			{ ach: "R2", display: "Rare Two" },
			{ ach: "R3", display: "Rare Three" },
		]);

		const built = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appId])
			.withRarityThreshold(0.2) // <= 20%
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		const cntAttempt = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appId])
			.withRarityThreshold(0.2)
			.count();

		assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
		assert.strictEqual(cntAttempt.data, built.data.length);
	});

	test("count equals build().data.length with withSearch", async () => {
		const { repo: appRepo } = makeAppRepoWithMocks(db);
		const appAchRepo = new AppAchievementRepository(db, appRepo);

		const appId = 99003;
		await seedAppWithPlayers(db, appId, "Search App", 1800);
		await seedStats(db, appId, [
			{ ach: "SA1", percent: 15 },
			{ ach: "SB1", percent: 25 },
		]);
		await seedMetaByCode(db, appId, "en", [
			{ ach: "SA1", display: "Alpha Wolf" },
			{ ach: "SB1", display: "Beta Fish" },
		]);

		const built = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appId])
			.withSearch("alpha")
			.build({ sort: { method: "rarity_pct", direction: "asc" } });

		const cntAttempt = await appAchRepo
			.compose()
			.withLanguage("en")
			.withAppIds([appId])
			.withSearch("alpha")
			.count();

		assert.strictEqual(cntAttempt.status, AttemptStatus.Ok);
		assert.strictEqual(cntAttempt.data, built.data.length);
	});
});

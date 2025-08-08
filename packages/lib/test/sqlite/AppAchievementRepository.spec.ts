import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AppAchievementRepository } from "../../src/repositories/sqlite/AppAchievement";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { apps } from "../../src/repositories/sqlite/schema.js";
import { insertAppByCode, seedAppWithPlayers, seedMetaByCode, seedStats } from "../fixtures/appAchievementsData";
import { createAppRepository } from "../fixtures/mockHelpers";
import { runMigrations } from "../helpers/migrate";

describe("AppAchievementRepository - SQLite (in-memory)", () => {
    let db: ProjectDB;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");

        // Align sqlite behavior
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");

        // Apply migrations once per test DB
        await runMigrations(sqlite);

        db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;

        // Truncate if previous tests left data (defensive)
        // Removed redundant truncateAll; new in-memory DB per test is already clean
        try {
            // no-op
        } catch {}
    });

    test("returns English achievements and sorts by rarity_pct asc", async () => {
        const appId = 91001;
        await seedAppWithPlayers(db, appId, "Rarity App", 2000);
        await seedStats(db, appId, [
            { ach: "A_RARE", percent: 5 },
            { ach: "A_COMMON", percent: 20 },
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "A_RARE", display: "Rare One", description: "Desc rare" },
            { ach: "A_COMMON", display: "Common Two", description: "Desc common" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const result = await repo
            .compose()
            .withLanguage("en")
            .withAppIds(appId)
            .build({ sort: { method: "rarity_pct", direction: "asc" } });

        assert.strictEqual(result.data.length, 2);
        const names = result.data.map((a) => a.name);
        // 5% (rarer) should come before 20% when ascending by percent
        assert.deepStrictEqual(names, ["Rare One", "Common Two"]);
        // sanity: ensure globalPercentage aligns
        const percents = result.data.map((a) => a.globalPercentage);
        assert.deepStrictEqual(percents, [5, 20]);
    });

    test("French request falls back to English meta when FR missing", async () => {
        const appId = 91002;
        await seedAppWithPlayers(db, appId, "Fallback App", 1500);
        // Ensure FR app row exists to avoid network fetch in ensureDataExists
        await insertAppByCode(db, { id: appId, langCode: "fr", name: "Fallback App FR" });
        await seedStats(db, appId, [{ ach: "A1", percent: 10 }]);
        await seedMetaByCode(db, appId, "en", [{ ach: "A1", display: "English Name", description: "EN Desc" }]);
        // Note: no french meta is seeded

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const result = await repo.compose().withLanguage("fr").withAppIds(appId).build();
        assert.strictEqual(result.data.length, 1);
        const a = result.data[0];
        if (!a) throw new Error("Expected one achievement");
        // Should have English strings and language resolved to 'en' due to fallback
        assert.strictEqual(a.name, "English Name");
        assert.strictEqual(a.language, "en");
    });

    test("French meta differs — uses FR meta and language remains 'fr'", async () => {
        const appId = 91003;
        await seedAppWithPlayers(db, appId, "FR App", 500);
        // Ensure FR app row exists to avoid network fetch in ensureDataExists
        await insertAppByCode(db, { id: appId, langCode: "fr", name: "FR App" });
        await seedStats(db, appId, [{ ach: "ACHX", percent: 12 }]);
        await seedMetaByCode(db, appId, "en", [{ ach: "ACHX", display: "Name EN", description: "Desc EN" }]);
        await seedMetaByCode(db, appId, "fr", [{ ach: "ACHX", display: "Nom FR", description: "Desc FR" }]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const result = await repo.compose().withLanguage("fr").withAppIds(appId).build();
        assert.strictEqual(result.data.length, 1);
        const a = result.data[0];
        if (!a) throw new Error("Expected one achievement");
        assert.strictEqual(a.name, "Nom FR");
        assert.strictEqual(a.language, "fr");
    });

    // withRarityThreshold
    test("withRarityThreshold filters by max rarity", async () => {
        const appId = 91004;
        await seedAppWithPlayers(db, appId, "Rare Filter", 800);
        await seedStats(db, appId, [
            { ach: "R1", percent: 3 },
            { ach: "R2", percent: 8 },
            { ach: "R3", percent: 15 },
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "R1", display: "R1" },
            { ach: "R2", display: "R2" },
            { ach: "R3", display: "R3" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const result = await repo
            .compose()
            .withLanguage("en")
            .withAppIds(appId)
            .withRarityThreshold(0.1) // 10%
            .build({ sort: { method: "rarity_pct", direction: "asc" } });

        const ids = result.data.map((a) => a.id).sort();
        // R3 (15%) should be filtered out
        assert.deepStrictEqual(ids, ["R1", "R2"]);
    });

    // withSearch variations
    test("withSearch matches achievement display name (single-term)", async () => {
        const appId = 91005;
        await seedAppWithPlayers(db, appId, "Searchable App", 1200);
        await seedStats(db, appId, [
            { ach: "S1", percent: 11 },
            { ach: "S2", percent: 22 },
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "S1", display: "Stealth Master" },
            { ach: "S2", display: "Loud Runner" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const result = await repo.compose().withLanguage("en").withAppIds(appId).withSearch("stealth").build();

        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0]?.name, "Stealth Master");
    });
    test("withSearch matches app name (case-insensitive, terms tokenized)", async () => {
        const appId = 91013;
        await seedAppWithPlayers(db, appId, "Mystery Quest", 4200);
        await seedStats(db, appId, [
            { ach: "MQ1", percent: 35 },
            { ach: "MQ2", percent: 12 },
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "MQ1", display: "Novice Explorer", description: "Begin your journey" },
            { ach: "MQ2", display: "Master Sleuth", description: "Solve the greatest riddles" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        // Should match app name "Mystery Quest"
        const res = await repo.compose().withLanguage("en").withSearch("MYSTERY!").build();
        assert.strictEqual(res.data.length, 2);
        const names = res.data.map((a) => a.name).sort();
        assert.deepStrictEqual(names, ["Master Sleuth", "Novice Explorer"]);
    });
    test("withSearch matches achievement display name", async () => {
        const appId = 91014;
        await seedAppWithPlayers(db, appId, "Silent Ops", 3800);
        await seedStats(db, appId, [
            { ach: "SO1", percent: 44 },
            { ach: "SO2", percent: 5 },
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "SO1", display: "Shadow Walker", description: "Move unseen" },
            { ach: "SO2", display: "Loud And Proud", description: "Make some noise" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const res = await repo.compose().withLanguage("en").withAppIds(appId).withSearch("shadow").build();
        assert.strictEqual(res.data.length, 1);
        assert.strictEqual(res.data[0]?.name, "Shadow Walker");
    });
    test("withSearch matches achievement description (multi-term, punctuation)", async () => {
        const appId = 91015;
        await seedAppWithPlayers(db, appId, "Whispering Depths", 2600);
        await seedStats(db, appId, [{ ach: "WD1", percent: 13 }]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "WD1", display: "Ear To The Ground", description: "Whisper of shadows beneath!" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        // Should match words split/normalized; punctuation ignored; case-insensitive
        const res = await repo.compose().withLanguage("en").withAppIds(appId).withSearch("whisper shadows").build();
        assert.strictEqual(res.data.length, 1);
        assert.strictEqual(res.data[0]?.name, "Ear To The Ground");
    });

    // withRequiredAppSubquery variations
    test("withRequiredAppSubquery limits to subquery apps only", async () => {
        const appA = 91007;
        const appB = 91008;

        await seedAppWithPlayers(db, appA, "App A", 3000);
        await seedAppWithPlayers(db, appB, "App B", 4000);

        await seedStats(db, appA, [{ ach: "AX", percent: 7 }]);
        await seedStats(db, appB, [{ ach: "BX", percent: 9 }]);

        await seedMetaByCode(db, appA, "en", [{ ach: "AX", display: "A-X" }]);
        await seedMetaByCode(db, appB, "en", [{ ach: "BX", display: "B-X" }]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        // Subquery returns only appA
        const appIdsSubquery = db.select({ app_id: apps.id }).from(apps).where(eq(apps.id, appA)).getSQL();

        const result = await repo.compose().withLanguage("en").withRequiredAppSubquery(appIdsSubquery).build();

        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0]?.name, "A-X");
    });
    test("withRequiredAppSubquery with no matches returns empty", async () => {
        const appId = 91016;
        await seedAppWithPlayers(db, appId, "Subquery None", 1500);
        await seedStats(db, appId, [{ ach: "SN1", percent: 8 }]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "SN1", display: "No Match", description: "Should not be returned" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        // Subquery intentionally matches no apps
        const appIdsSubquery = db.select({ app_id: apps.id }).from(apps).where(sql`1 = 0`).getSQL();

        const res = await repo.compose().withLanguage("en").withRequiredAppSubquery(appIdsSubquery).build();
        assert.strictEqual(res.data.length, 0);
    });

    test("sort by rarity_score (desc) accounts for estimated players and percent", async () => {
        const appId = 91006;
        await seedAppWithPlayers(db, appId, "Score App", 10000);
        await seedStats(db, appId, [
            { ach: "C50", percent: 50 }, // score ≈ 5000
            { ach: "C10", percent: 10 }, // score ≈ 1000
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "C50", display: "Fifty" },
            { ach: "C10", display: "Ten" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const result = await repo
            .compose()
            .withLanguage("en")
            .withAppIds(appId)
            .build({ sort: { method: "rarity_score", direction: "desc" } });

        assert.strictEqual(result.data.length, 2);
        const names = result.data.map((a) => a.name);
        // 50% should have higher score with same estimated players
        assert.deepStrictEqual(names, ["Fifty", "Ten"]);
    });

    test("pagination (limit/offset) applies at SQL level", async () => {
        const appId = 91009;
        await seedAppWithPlayers(db, appId, "Paging App", 2500);
        await seedStats(db, appId, [
            { ach: "P1", percent: 5 },
            { ach: "P2", percent: 6 },
            { ach: "P3", percent: 7 },
        ]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "P1", display: "P1" },
            { ach: "P2", display: "P2" },
            { ach: "P3", display: "P3" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        // Intentionally using non-zero cursor to validate offset behavior in this test
        const result = await repo
            .compose()
            .withLanguage("en")
            .withAppIds(appId)
            .build({ sort: { method: "rarity_pct", direction: "asc" }, limit: 2, cursor: 1 });

        // Asc by percent: [P1(5), P2(6), P3(7)] → offset 1 → [P2, P3] limited to 2
        const names = result.data.map((a) => a.name);
        assert.deepStrictEqual(names, ["P2", "P3"]);
    });
    test("no estimated players rows => no achievements", async () => {
        const appId = 91010;
        // Seed app but deliberately do NOT seed estimated_players
        await insertAppByCode(db, { id: appId, langCode: "en", name: "No Players App" });
        await seedStats(db, appId, [{ ach: "N1", percent: 5 }]);
        await seedMetaByCode(db, appId, "en", [
            { ach: "N1", display: "No Players One", description: "Missing players row" },
        ]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const res = await repo.compose().withLanguage("en").withAppIds(appId).build();
        // Inner join on estimatedPlayers means we expect zero results if no row exists
        assert.strictEqual(res.data.length, 0);
    });

    test("no achievement stats => no achievements", async () => {
        const appId = 91011;
        await seedAppWithPlayers(db, appId, "No Stats App", 5000);
        // Deliberately do NOT insert into achievements_stats
        await seedMetaByCode(db, appId, "en", [{ ach: "X1", display: "Meta Exists", description: "But stats do not" }]);

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const res = await repo.compose().withLanguage("en").withAppIds(appId).build();
        assert.strictEqual(res.data.length, 0);
    });

    test("no metadata in any language => no achievements returned", async () => {
        const appId = 91012;
        await seedAppWithPlayers(db, appId, "No Meta App", 5000);
        await seedStats(db, appId, [{ ach: "Z1", percent: 12 }]);
        // No achievementsMeta in any language

        const appRepo = createAppRepository(db);
        const repo = new AppAchievementRepository(db, appRepo);

        const res = await repo.compose().withLanguage("en").withAppIds(appId).build();
        // Rows with missing meta are filtered out in mapping
        assert.strictEqual(res.data.length, 0);
    });
});

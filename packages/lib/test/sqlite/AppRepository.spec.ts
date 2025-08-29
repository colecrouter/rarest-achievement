import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { AttemptStatus } from "../../src/error";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import {
    achievementsMeta,
    achievementsStats,
    apps,
    estimatedPlayers,
    ownedGames,
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
import { runMigrations } from "../helpers/migrate";

describe("AppRepository - SQLite (in-memory)", () => {
    let db: ProjectDB;
    let ctx: ReturnType<typeof makeAppRepoWithMocks>;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");

        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");

        await runMigrations(sqlite);
        db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;

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

    test("French localization identical to English – only English meta stored", async () => {
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
        auth.setSchemaForGame({ appid: fixtureAppEn.appid, l: "french" }, makeAchievementSchema("Test Game", []));

        await repo.compose().withLanguage("fr").withAppIds(fixtureAppEn.appid).build();

        // Verify only EN meta remains
        const metaAll = await db
            .select({
                app_id: achievementsMeta.app_id,
                ach_id: achievementsMeta.ach_id,
                lang: achievementsMeta.lang,
            })
            .from(achievementsMeta);
        const metaRows = metaAll.filter((r) => r.app_id === fixtureAppEn.appid);
        assert.strictEqual(metaRows.length, 1, "Only English meta should be stored");
        const first = metaRows[0];
        assert.ok(first, "Expected at least one meta row");
        assert.strictEqual(first.lang, "english");
    });

    test("French localization differs – both languages stored", async () => {
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
            .select({ app_id: achievementsMeta.app_id, ach_id: achievementsMeta.ach_id, lang: achievementsMeta.lang })
            .from(achievementsMeta);
        const forApp = metaAll2.filter((r) => r.app_id === fixtureAppEn.appid && r.ach_id === basicAchievementEn.name);
        const langs = new Set(forApp.map((r) => r.lang));
        assert.strictEqual(forApp.length, 2, "Both EN and FR meta should be stored");
        assert.deepStrictEqual(langs, new Set(["english", "french"]));

        // Also verify selection behavior by language
        const frResult = await repo.compose().withLanguage("fr").withAppIds(fixtureAppEn.appid).build();
        assert.strictEqual(frResult.data.length >= 1, true);

        const enResult = await repo.compose().withLanguage("en").withAppIds(fixtureAppEn.appid).build();
        assert.strictEqual(enResult.data.length >= 1, true);
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
});

describe("Upsert regression - App repository", () => {
    let db: ProjectDB;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");
        await runMigrations(sqlite);
        db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;
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
                    data: sql`excluded.data`,
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
                    percent: sql`excluded.percent`,
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

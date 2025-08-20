import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";

import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { achievementsMeta, achievementsStats, estimatedPlayers } from "../../src/repositories/sqlite/schema.js";
import { runMigrations } from "../helpers/migrate";
import { makeAchievementSchema, basicAchievement, makeAppData } from "../fixtures/appData";
import { makeAppRepoWithMocks } from "../fixtures/mockHelpers";
import { AppAchievementRepository } from "../../src/repositories/sqlite/AppAchievement";

describe("AppAchievementRepository - upsert regression (sqlite)", () => {
    let db: ProjectDB;

    beforeEach(async () => {
        const sqlite = new Database(":memory:");
        sqlite.exec("PRAGMA case_sensitive_like = ON;");
        sqlite.exec("PRAGMA journal_mode = WAL;");
        sqlite.exec("PRAGMA synchronous = NORMAL;");
        await runMigrations(sqlite);
        db = drizzle(sqlite, { logger: false }) as unknown as ProjectDB;
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
                    display_name: sql`excluded.display_name`,
                    default_value: sql`excluded.default_value`,
                    description: sql`excluded.description`,
                    icon: sql`excluded.icon`,
                    icon_gray: sql`excluded.icon_gray`,
                    hidden: sql`excluded.hidden`,
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

        // Estimated players only for appA
        await db.insert(estimatedPlayers).values({ app_id: appA, estimated_players: 1000, updated_at: new Date() });

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

        // Estimated players: positive, zero, negative
        await db.insert(estimatedPlayers).values({ app_id: appPos, estimated_players: 1000, updated_at: new Date() });
        await db.insert(estimatedPlayers).values({ app_id: appZero, estimated_players: 0, updated_at: new Date() });
        await db.insert(estimatedPlayers).values({ app_id: appNeg, estimated_players: -5, updated_at: new Date() });

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
});

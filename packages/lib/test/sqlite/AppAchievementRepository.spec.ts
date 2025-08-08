import { strict as assert } from "node:assert";
import { beforeEach, describe, test } from "node:test";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";

import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { achievementsMeta } from "../../src/repositories/sqlite/schema.js";
import { runMigrations } from "../helpers/migrate";

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
});

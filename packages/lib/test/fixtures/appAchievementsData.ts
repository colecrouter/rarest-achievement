import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { achievementsStats, estimatedPlayers } from "../../src/repositories/sqlite/schema";
import { insertAchievementMeta, insertApp } from "./dbHelpers";
import { makeAppData } from "./appData";

/**
 * Seed an app row (EN) and an estimated players row for convenience in achievement tests.
 */
export async function seedAppWithPlayers(db: ProjectDB, appId: number, name = "Test App", players = 1000) {
    await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, name) });
    await db.insert(estimatedPlayers).values({
        app_id: appId,
        estimated_players: players,
        updated_at: new Date(),
    });
}

/**
 * Seed achievement global stats (percentages) for an app.
 */
export async function seedStats(db: ProjectDB, appId: number, items: Array<{ ach: string; percent: number }>) {
    for (const it of items) {
        await db.insert(achievementsStats).values({
            app_id: appId,
            ach_id: it.ach,
            percent: it.percent,
            updated_at: new Date(),
        });
    }
}

/**
 * Seed achievement metadata for an app in a specific language.
 */
export async function seedMeta(
    db: ProjectDB,
    appId: number,
    lang: "english" | "french",
    items: Array<{
        ach: string;
        display: string;
        description?: string;
        defaultValue?: number;
        hidden?: number;
        icon?: string;
        icongray?: string;
    }>,
) {
    for (const it of items) {
        await insertAchievementMeta(db, {
            app_id: appId,
            ach_id: it.ach,
            display_name: it.display,
            default_value: it.defaultValue ?? 0,
            description: it.description,
            icon: it.icon ?? "icon.png",
            icon_gray: it.icongray ?? "gray.png",
            hidden: it.hidden ?? 0,
            lang,
        });
    }
}

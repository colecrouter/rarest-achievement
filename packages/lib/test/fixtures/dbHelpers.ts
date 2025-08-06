import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { achievementsMeta, apps } from "../../src/repositories/sqlite/schema";
import type { SteamAppRaw } from "../../src/models";
import type { APILanguageCode } from "../../src/lang";

/**
 * Insert an app record into the database
 */
export async function insertApp(
    db: ProjectDB,
    { id, lang, data }: { id: number; lang: APILanguageCode; data: SteamAppRaw },
) {
    await db.insert(apps).values({
        id,
        lang,
        data,
        updated_at: new Date(),
    });
}

/**
 * Insert achievement metadata into the database
 */
export async function insertAchievementMeta(
    db: ProjectDB,
    {
        app_id,
        ach_id,
        display_name,
        default_value,
        description,
        icon,
        icon_gray,
        hidden,
        lang,
    }: {
        app_id: number;
        ach_id: string;
        display_name: string;
        default_value: number;
        description?: string;
        icon: string;
        icon_gray: string;
        hidden: number;
        lang: APILanguageCode;
    },
) {
    await db.insert(achievementsMeta).values({
        app_id,
        ach_id,
        display_name,
        default_value,
        description: description || "",
        icon,
        icon_gray,
        hidden,
        lang,
    });
}

/**
 * Truncate all tables for clean test setup
 */
export async function truncateAll(db: ProjectDB) {
    // Note: Since this is SQLite, we use DELETE instead of TRUNCATE
    try {
        await db.delete(achievementsMeta);
        await db.delete(apps);
    } catch (error) {
        // Ignore errors if tables don't exist yet
        console.warn("Error truncating tables:", error);
    }
}

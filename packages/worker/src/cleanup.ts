import {
    type ProjectDB,
    type SteamAuthenticatedAPIClient,
    type VaultService,
    achievementsMeta,
    achievementsStats,
    apps,
    getLanguageByAPICode,
} from "@project/lib";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { chunkArray } from "../../lib/src/repositories/sqlite/utils";

export const refreshStaleApps = async (db: ProjectDB, service: VaultService, count: number) => {
    const ONE_DAY_AGO = new Date();
    ONE_DAY_AGO.setDate(ONE_DAY_AGO.getDate() - 1);

    // Get the oldest apps that are older than 1 day
    const keys = await db
        .select({ id: apps.id, lang: apps.lang })
        .from(apps)
        .where(lt(apps.updated_at, ONE_DAY_AGO))
        .orderBy(asc(apps.updated_at))
        .limit(count);

    if (keys.length === 0) return;

    for (const pair of keys) {
        // Delete the stale apps
        await db.batch([
            db.delete(apps).where(and(eq(apps.id, pair.id), eq(apps.lang, pair.lang))),
            db
                .delete(achievementsMeta)
                .where(and(eq(achievementsMeta.app_id, pair.id), eq(achievementsMeta.lang, pair.lang))),
            db.delete(achievementsStats).where(and(eq(achievementsStats.app_id, pair.id))),
        ]);

        const lang = getLanguageByAPICode(pair.lang);
        if (!lang) throw new Error(`Unsupported language code: ${pair.lang}`);

        // Fetch the latest app data from the API
        await service.getAppsWithFullData({
            appIds: [pair.id],
            lang: lang.storeCode,
        });
    }
};

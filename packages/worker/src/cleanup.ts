import {
    type ProjectDB,
    SteamAPIRepository,
    type SteamAuthenticatedAPIClient,
    SteamCacheDBRepository,
    apps,
} from "@project/lib";
import { asc, lt } from "drizzle-orm";

export const refreshStaleApps = async (db: ProjectDB, api: SteamAuthenticatedAPIClient, count: number) => {
    const ONE_DAY_AGO = new Date();
    ONE_DAY_AGO.setDate(ONE_DAY_AGO.getDate() - 1);

    // Get the oldest apps that are older than 1 day
    const appIds = await db
        .select({ id: apps.id, lang: apps.lang })
        .from(apps)
        .where(lt(apps.updated_at, ONE_DAY_AGO))
        .orderBy(asc(apps.updated_at))
        .limit(count);

    // Build new API repository, so we can fetch fresh data
    const apiRepository = new SteamAPIRepository(api);
    const dbRepository = new SteamCacheDBRepository(db);

    for (const app of appIds) {
        // If the app is not in the database, skip it
        if (!app.id) continue;

        // Fetch the app details from the API
        const appsResponse = await apiRepository.getApps([app.id], app.lang);
        const achievementResponse = await apiRepository.getGameAchievements([app.id], app.lang);

        // Update the app in the database
        await dbRepository.putApps(appsResponse.data, app.lang);
        await dbRepository.putGameAchievements(achievementResponse.data, app.lang);
    }
};

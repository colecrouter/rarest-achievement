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
        .select({ id: apps.id })
        .from(apps)
        .where(lt(apps.updated_at, ONE_DAY_AGO))
        .orderBy(asc(apps.updated_at))
        .limit(count)
        .then((rows) => rows.map((row) => row.id));

    // Build new API repository, so we can fetch fresh data
    const apiRepository = new SteamAPIRepository(api);

    const appsResponse = await apiRepository.getApps(appIds);
    const achievementResponse = await apiRepository.getGameAchievements(appIds);

    // May contain an error if rate limited, etc.
    // In that case, just ignore, and work with what we got
    const updatedApps = appsResponse.data;
    const updatedAchievements = achievementResponse.data;

    // Declare new DB repository, so we can save the data
    const dbRepository = new SteamCacheDBRepository(db);

    // Save the data to the database
    await dbRepository.putApps(updatedApps);
    await dbRepository.putGameAchievements(updatedAchievements);
};

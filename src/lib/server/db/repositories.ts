import { getRequestEvent } from "$app/server";
import type { OwnedGame } from "$lib/server/api/steampowered/owned";
import type { SteamAppRaw } from "$lib/steam/data/SteamApp";
import type { SteamAchievementRawGlobalStats, SteamAchievementRawMeta } from "$lib/steam/data/SteamAppAchievement";
import type { SteamFriendsListRaw } from "$lib/steam/data/SteamFriendsList";
import type { SteamUSerAchievementRawStats } from "$lib/steam/data/SteamUserAchievement";
import { and, eq, inArray, sql } from "drizzle-orm";
import { achievementsMeta, achievementsStats, apps, friends, ownedGames, userAchievements, users } from "./schema";
import type { SteamUserRaw } from "$lib/steam/data/SteamUser";

export async function getSteamUsersDB(steamId: string[]) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const chunkSize = 100;
    const idBatches: string[][] = [];
    for (let i = 0; i < steamId.length; i += chunkSize) {
        idBatches.push(steamId.slice(i, i + chunkSize));
    }
    const batches = idBatches.map((ids) => db.select().from(users).where(inArray(users.id, ids)));

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const results = await db.batch([batches[0]!, ...batches.slice(1)]);
    const result = results.flat(1);

    return new Map(result.map((row) => [row.id, row.data]));
}

export async function upsertSteamUsersDB(data: Awaited<ReturnType<typeof getSteamUsersDB>>) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const map = [...data.entries()].map(([userId, user]) => ({
        id: userId,
        data: user,
    }));

    const chunkSize = 20;
    const idBatches: { id: string; data: SteamUserRaw }[][] = [];
    for (let i = 0; i < map.length; i += chunkSize) {
        idBatches.push(map.slice(i, i + chunkSize));
    }
    const batches = idBatches.map((ids) =>
        db
            .insert(users)
            .values(ids)
            .onConflictDoUpdate({
                target: [users.id],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            }),
    );
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    await db.batch([batches[0]!, ...batches.slice(1)]);
}

export async function getSteamAppsDB(appId: number[]) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const chunkSize = 90; // max parameters per SQL statement
    const results = [];
    for (let i = 0; i < appId.length; i += chunkSize) {
        const chunk = appId.slice(i, i + chunkSize);
        const res = await db
            .select()
            .from(apps)
            .where(and(inArray(apps.id, chunk)));
        results.push(...res);
    }

    const map = new Map<number, SteamAppRaw>();
    for (const row of results) {
        const appId = row.id;
        const appData = row.data;
        if (!appData) continue;
        map.set(appId, appData);
    }
    return map;
}

export async function upsertSteamAppsDB(data: Awaited<ReturnType<typeof getSteamAppsDB>>) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const items = [...data.entries()].map(([appId, app]) => ({
        id: appId,
        data: app,
    }));

    for (let i = 0; i < items.length; i++) {
        const chunk = items.slice(i, i + 1);
        await db
            .insert(apps)
            .values(chunk)
            .onConflictDoUpdate({
                target: [apps.id],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }
}

export async function getOwnedSteamGamesDB(userId: string[]) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const res = await db.select().from(ownedGames).where(inArray(ownedGames.user_id, userId));

    const result = new Map<string, OwnedGame<false>[]>();
    for (const row of res) {
        const userId = row.user_id;
        const ownedGames = row.data;
        if (!ownedGames) continue;

        if (!result.has(userId)) {
            result.set(userId, []);
        }
        const userOwnedGames = result.get(userId);
        userOwnedGames?.push(...ownedGames);
    }
    return result;
}

export async function upsertOwnedGames(data: Awaited<ReturnType<typeof getOwnedSteamGamesDB>>) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const d = [...data.entries()].map(([userId, games]) => ({
        user_id: userId,
        data: games,
    }));

    console.log("upsertOwnedGamesDB", d[0]?.data);

    await db
        .insert(ownedGames)
        .values(d)
        .onConflictDoUpdate({
            target: [ownedGames.user_id],
            set: { updated_at: new Date(), data: sql`excluded.data` },
        });
}

export async function getSteamUserAchievementsDB(appId: number[], userId: string[], lang = "english") {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    // Determine chunk size based on count of parameters
    // Each SQL statement can have a maximum of 100 parameters
    // For simplicity, we'll only fetch 1 appId at a time
    const chunkSize = 100 / 3; // 50 for appId and 50 for userId
    const crossProductPairs: [number, string][] = [];
    for (const app of appId) {
        for (const user of userId) {
            crossProductPairs.push([app, user]);
        }
    }

    // Group the cross product pairs into chunks
    const chunkedPairs: [number, string][][] = [];
    for (let i = 0; i < crossProductPairs.length; i += chunkSize) {
        chunkedPairs.push(crossProductPairs.slice(i, i + chunkSize));
    }

    const batches = chunkedPairs.map((pairs) =>
        db
            .select()
            .from(userAchievements)
            .where(
                and(
                    inArray(
                        userAchievements.app_id,
                        pairs.map((pair) => pair[0]),
                    ),
                    inArray(
                        userAchievements.user_id,
                        pairs.map((pair) => pair[1]),
                    ),
                ),
            ),
    );

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const achievementsRes = await db.batch([batches[0]!, ...batches.slice(1)]);
    const flattenedAchievements = achievementsRes.flat(1);

    // Batch another request for just the achievement data
    const chunkSize2 = 100 - 1; // 1 for lang
    const batchedGameIds: number[][] = [];
    for (let i = 0; i < appId.length; i += chunkSize2) {
        batchedGameIds.push(appId.slice(i, i + chunkSize2));
    }

    const batches2 = batchedGameIds.map((ids) =>
        db
            .select({
                achievements_stats: achievementsStats,
                achievements_meta: {
                    app_id: achievementsMeta.app_id,
                    lang: achievementsMeta.lang,
                    // Use COALESCE so that if achievementsMeta.data is null, it returns "[]" (which is valid JSON)
                    // 🤬🤬🤬
                    data: sql<SteamAchievementRawMeta[]>`COALESCE(${achievementsMeta.data}, '[]')`.as("data"),
                    updated_at: achievementsMeta.updated_at,
                },
            })
            .from(achievementsStats)
            .leftJoin(
                achievementsMeta,
                and(eq(achievementsMeta.app_id, achievementsStats.app_id), eq(achievementsMeta.lang, lang)),
            )
            .where(inArray(achievementsStats.app_id, ids)),
    );

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const statsRes = await db.batch([batches2[0]!, ...batches2.slice(1)]);
    const flattenedStats = statsRes.flat(1);

    const gameOutput = new Map<
        number,
        Map<
            string,
            Map<
                string,
                {
                    meta: SteamAchievementRawMeta;
                    global: SteamAchievementRawGlobalStats;
                    userStats: SteamUSerAchievementRawStats | null;
                }
            >
        >
    >();

    for (const row of flattenedAchievements) {
        const { app_id, user_id } = row;

        const matched = flattenedStats.find((s) => s.achievements_stats.app_id === app_id);
        const appMeta = matched?.achievements_meta?.data ?? [];
        const globalStats = matched?.achievements_stats.data ?? [];

        for (const achievement of row.data ?? []) {
            const achievementId = achievement.apiname;
            const userStats = achievement;

            const meta = appMeta.find((m) => m.name === achievementId);
            const global = globalStats.find((g) => g.name === achievementId);

            if (!meta || !global) continue;
            if (!gameOutput.has(app_id)) {
                gameOutput.set(app_id, new Map());
            }
            if (!gameOutput.get(app_id)?.has(user_id)) {
                gameOutput.get(app_id)?.set(user_id, new Map());
            }
            gameOutput.get(app_id)?.get(user_id)?.set(achievementId, {
                meta,
                global,
                userStats,
            });
        }
    }

    return gameOutput;
}

export async function upsertSteamUserAchievementsDB(
    data: Awaited<ReturnType<typeof getSteamUserAchievementsDB>>,
    lang = "english",
) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    // Aggregate meta and global stats per app; and user achievements per (app, user) pair
    const metaByApp = new Map<number, SteamAchievementRawMeta[]>(); // any[] for meta values
    const globalByApp = new Map<number, SteamAchievementRawGlobalStats[]>(); // any[] for global stat values
    const userByAppUser = new Map<string, SteamUSerAchievementRawStats[]>(); // key: `${appId}|${userId}` for user achievement values

    for (const [appId, userMap] of data.entries()) {
        for (const [userId, achievements] of userMap.entries()) {
            for (const [, entry] of achievements.entries()) {
                // Aggregate meta records by app id.
                if (!metaByApp.has(appId)) {
                    metaByApp.set(appId, []);
                }
                metaByApp.get(appId)?.push(entry.meta);
                // Aggregate global records by app id.
                if (!globalByApp.has(appId)) {
                    globalByApp.set(appId, []);
                }
                globalByApp.get(appId)?.push(entry.global);
                // Aggregate user achievement records by appId and userId.
                const key = `${appId}|${userId}`;
                if (!userByAppUser.has(key)) {
                    userByAppUser.set(key, []);
                }
                if (entry.userStats) {
                    userByAppUser.get(key)?.push(entry.userStats);
                }
            }
        }
    }

    // Build record arrays for batch upsert.
    const metaRecords = Array.from(metaByApp.entries()).map(([app_id, dataArr]) => ({
        app_id,
        lang,
        data: dataArr,
    }));
    const globalRecords = Array.from(globalByApp.entries()).map(([app_id, dataArr]) => ({
        app_id,
        lang,
        data: dataArr,
    }));
    const userRecords = Array.from(userByAppUser.entries()).map((entry) => {
        const [key, dataArr] = entry;
        const [app_idStr, user_id] = key.split("|") as [string, string];
        return {
            app_id: Number(app_idStr),
            user_id,
            lang,
            data: dataArr,
        };
    });

    const chunkSize = 20; // adjust based on SQL parameter limits

    // Batch upsert for meta records: conflict target is (app_id, lang)
    for (let i = 0; i < metaRecords.length; i += chunkSize) {
        const chunk = metaRecords.slice(i, i + chunkSize);
        await db
            .insert(achievementsMeta)
            .values(chunk)
            .onConflictDoUpdate({
                target: [achievementsMeta.app_id, achievementsMeta.lang],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }

    // Batch upsert for global stats records: conflict target is (app_id, lang)
    for (let i = 0; i < globalRecords.length; i += chunkSize) {
        const chunk = globalRecords.slice(i, i + chunkSize);
        await db
            .insert(achievementsStats)
            .values(chunk)
            .onConflictDoUpdate({
                target: [achievementsStats.app_id],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }

    // Batch upsert for user achievement records: conflict target is (app_id, user_id, lang)
    for (let i = 0; i < userRecords.length; i += chunkSize) {
        const chunk = userRecords.slice(i, i + chunkSize);
        await db
            .insert(userAchievements)
            .values(chunk)
            .onConflictDoUpdate({
                target: [userAchievements.app_id, userAchievements.user_id],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }
}

export async function getSteamGameAchievementsDB(appId: number[], lang = "english") {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const chunkSize = 100;

    // Group the cross product pairs into chunks
    const batchedGameIds: number[][] = [];
    for (let i = 0; i < appId.length; i += chunkSize) {
        batchedGameIds.push(appId.slice(i, i + chunkSize));
    }

    const batches2 = batchedGameIds.map((ids) =>
        db
            .select({
                achievements_stats: achievementsStats,
                achievements_meta: {
                    app_id: achievementsMeta.app_id,
                    lang: achievementsMeta.lang,
                    // Use COALESCE so that if achievementsMeta.data is null, it returns "[]" (which is valid JSON)
                    // 🤬🤬🤬
                    data: sql<SteamAchievementRawMeta[]>`COALESCE(${achievementsMeta.data}, '[]')`.as("data"),
                    updated_at: achievementsMeta.updated_at,
                },
            })
            .from(achievementsStats)
            .leftJoin(
                achievementsMeta,
                and(eq(achievementsMeta.app_id, achievementsStats.app_id), eq(achievementsMeta.lang, lang)),
            )
            .where(inArray(achievementsStats.app_id, ids)),
    );

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const statsRes = await db.batch([batches2[0]!, ...batches2.slice(1)]);
    const flattenedStats = statsRes.flat(1);

    const gameOutput = new Map<
        number,
        Map<
            string,
            {
                meta: SteamAchievementRawMeta;
                global: SteamAchievementRawGlobalStats;
            }
        >
    >();

    for (const row of flattenedStats) {
        const appId = row.achievements_stats.app_id;
        const appMeta = row.achievements_meta?.data ?? [];
        const globalStats = row.achievements_stats.data ?? [];
        const gameId = appId;
        if (!gameOutput.has(gameId)) {
            gameOutput.set(gameId, new Map());
        }
        const gameMap = gameOutput.get(gameId);
        for (const achievement of globalStats) {
            const achievementId = achievement.name;
            const meta = appMeta.find((m) => m.name === achievementId);
            if (!meta) continue;

            gameMap?.set(achievementId, {
                meta,
                global: achievement,
            });
        }
    }

    return gameOutput;
}

export async function upsertGameAchievementsDB(
    data: Awaited<ReturnType<typeof getSteamGameAchievementsDB>>,
    lang = "english",
) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    // Aggregate meta and global stats per app; and user achievements per (app, user) pair
    const metaByApp = new Map<number, SteamAchievementRawMeta[]>(); // any[] for meta values
    const globalByApp = new Map<number, SteamAchievementRawGlobalStats[]>(); // any[] for global stat values

    for (const [appId, gameMap] of data.entries()) {
        for (const [, achievements] of gameMap.entries()) {
            const meta = achievements.meta;
            const global = achievements.global;

            // Aggregate meta records by app id.
            if (!metaByApp.has(appId)) {
                metaByApp.set(appId, []);
            }
            metaByApp.get(appId)?.push(meta);
            // Aggregate global records by app id.
            if (!globalByApp.has(appId)) {
                globalByApp.set(appId, []);
            }
            globalByApp.get(appId)?.push(global);
        }
    }

    // Build record arrays for batch upsert.
    const metaRecords = Array.from(metaByApp.entries()).map(([app_id, dataArr]) => ({
        app_id,
        lang,
        data: dataArr,
    }));
    const globalRecords = Array.from(globalByApp.entries()).map(([app_id, dataArr]) => ({
        app_id,
        lang,
        data: dataArr,
    }));

    const chunkSize = 30; // adjust based on SQL parameter limits

    // Batch upsert for meta records: conflict target is (app_id, lang)
    for (let i = 0; i < metaRecords.length; i += chunkSize) {
        const chunk = metaRecords.slice(i, i + chunkSize);
        await db
            .insert(achievementsMeta)
            .values(chunk)
            .onConflictDoUpdate({
                target: [achievementsMeta.app_id, achievementsMeta.lang],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }

    // Batch upsert for global stats records: conflict target is (app_id, lang)
    for (let i = 0; i < globalRecords.length; i += chunkSize) {
        const chunk = globalRecords.slice(i, i + chunkSize);
        await db
            .insert(achievementsStats)
            .values(chunk)
            .onConflictDoUpdate({
                target: [achievementsStats.app_id],
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }
}

export async function getSteamFriendsDB(userId: string[]) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const res = await db.select().from(friends).where(inArray(friends.user_id, userId));

    const result = new Map<string, SteamFriendsListRaw>();

    for (const { user_id, data } of res) {
        if (!result.has(user_id)) {
            result.set(user_id, []);
        }
        const friends = result.get(user_id);
        friends?.push(...data);
    }

    return result;
}

export async function upsertSteamFriendsDB(data: Awaited<ReturnType<typeof getSteamFriendsDB>>) {
    const { locals } = getRequestEvent();
    const { steamCacheDB: db } = locals;

    const map = [...data.entries()].map(([userId, friends]) => ({
        user_id: userId,
        data: friends,
    }));
    await db
        .insert(friends)
        .values(map)
        .onConflictDoUpdate({
            target: friends.user_id,
            set: { updated_at: new Date(), data: sql`excluded.data` },
        });
}

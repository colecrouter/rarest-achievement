import { getRequestEvent } from "$app/server";
import type { OwnedGame } from "$lib/server/api/steampowered/owned";
import type { SteamAppRaw } from "$lib/steam/data/SteamApp";
import type { SteamAchievementRawGlobalStats, SteamAchievementRawMeta } from "$lib/steam/data/SteamAppAchievement";
import type { SteamFriendsListRaw } from "$lib/steam/data/SteamFriendsList";
import type { SteamUserAchievementRawStats } from "$lib/steam/data/SteamUserAchievement";
import {
    and,
    eq,
    getTableColumns,
    getTableName,
    inArray,
    sql,
    type AnyTable,
    type InferSelectModel,
    type SQL,
    type TableConfig,
} from "drizzle-orm";
import { achievementsMeta, achievementsStats, apps, friends, ownedGames, userAchievements, users } from "./schema";
import type { SteamUserRaw } from "$lib/steam/data/SteamUser";
import type { Language } from "$lib/server/api/lang";

// https://github.com/drizzle-team/drizzle-orm/issues/555
function getTableAliasedColumns<T extends AnyTable<TableConfig>>(table: T) {
    type DataType = InferSelectModel<T>;
    const tableName = getTableName(table);
    const columns = getTableColumns(table);
    return Object.entries(columns).reduce(
        (acc, [columnName, column]) => {
            (acc as Record<string, unknown>)[columnName] = sql`${column}`.as(`${tableName}_${columnName}`);
            return acc;
        },
        {} as {
            [P in keyof DataType]: SQL.Aliased<DataType[P]>;
        },
    );
}

/**
 * SteamCacheDBRepository is a class that provides methods to interact with the Steam Cache database.
 * It allows for retrieving and storing data related to Steam users, apps, owned games, achievements, and friends.
 *
 * This data is not updated, and should not be relied on for up-to-date information.
 * It is not meant to be used directly, but rather through the EnhancedSteamAPIRepository class.
 */
export class SteamCacheDBRepository {
    #db: App.Locals["steamCacheDB"];

    constructor(db: App.Locals["steamCacheDB"]) {
        this.#db = db;
    }

    static fromLocals(locals: App.Locals): SteamCacheDBRepository {
        return new SteamCacheDBRepository(locals.steamCacheDB);
    }

    async getUsers(steamId: string[]) {
        const chunkSize = 100;
        const idBatches: string[][] = [];
        for (let i = 0; i < steamId.length; i += chunkSize) {
            idBatches.push(steamId.slice(i, i + chunkSize));
        }
        const batches = idBatches.map((ids) => this.#db.select().from(users).where(inArray(users.id, ids)));

        if (!batches[0]) return new Map();
        const results = await this.#db.batch([batches[0], ...batches.slice(1)]);
        const result = results.flat(1);

        return new Map(result.map((row) => [row.id, row.data]));
    }

    async putUsers(data: Awaited<ReturnType<typeof this.getUsers>>) {
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
            this.#db
                .insert(users)
                .values(ids)
                .onConflictDoUpdate({
                    target: [users.id],
                    set: { updated_at: new Date(), data: sql`excluded.data` },
                }),
        );

        if (!batches[0]) return;
        await this.#db.batch([batches[0], ...batches.slice(1)]);
    }

    async getApps(appId: number[]) {
        const chunkSize = 90; // max parameters per SQL statement
        const results = [];
        for (let i = 0; i < appId.length; i += chunkSize) {
            const chunk = appId.slice(i, i + chunkSize);
            const res = await this.#db
                .select()
                .from(apps)
                .where(and(inArray(apps.id, chunk)));
            results.push(...res);
        }

        const map = new Map<number, SteamAppRaw | null>();
        for (const row of results) {
            const appId = row.id;
            const appData = row.data;
            map.set(appId, appData);
        }

        return map;
    }

    async putApps(data: Awaited<ReturnType<typeof this.getApps>>) {
        const items = [...data.entries()].map(([appId, app]) => ({
            id: appId,
            data: app,
        }));

        for (const item of items) {
            await this.#db
                .insert(apps)
                .values(item)
                .onConflictDoUpdate({
                    target: [apps.id],
                    set: { updated_at: new Date(), data: sql`excluded.data` },
                });
        }
    }

    async getOwnedGames(userId: string[]) {
        const chunkSize = 100;
        const idBatches: string[][] = [];
        for (let i = 0; i < userId.length; i += chunkSize) {
            idBatches.push(userId.slice(i, i + chunkSize));
        }

        const batches = idBatches.map((ids) =>
            this.#db.select().from(ownedGames).where(inArray(ownedGames.user_id, ids)),
        );
        if (!batches[0]) return new Map();
        const results = await this.#db.batch([batches[0], ...batches.slice(1)]);
        const res = results.flat(1);

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

    async putOwnedGames(data: Awaited<ReturnType<typeof this.getOwnedGames>>) {
        const d = [...data.entries()].map(([userId, games]) => ({
            user_id: userId,
            data: games,
        }));

        const chunkSize = 20;
        const idBatches: { user_id: string; data: OwnedGame<false>[] }[][] = [];
        for (let i = 0; i < d.length; i += chunkSize) {
            idBatches.push(d.slice(i, i + chunkSize));
        }
        const batches = idBatches.map((ids) =>
            this.#db
                .insert(ownedGames)
                .values(ids)
                .onConflictDoUpdate({
                    target: [ownedGames.user_id],
                    set: { updated_at: new Date(), data: sql`excluded.data` },
                }),
        );

        if (!batches[0]) return;
        await this.#db.batch([batches[0], ...batches.slice(1)]);
    }

    async getUserAchievements(appId: number[], userId: string[]) {
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
        const batchedGameIds: number[][] = [];
        for (let i = 0; i < appId.length; i += chunkSize) {
            batchedGameIds.push(appId.slice(i, i + chunkSize));
        }

        const batches2 = batchedGameIds.map((ids) =>
            this.#db.select().from(userAchievements).where(inArray(userAchievements.app_id, ids)),
        );

        if (!batches2[0]) return new Map();
        const statsRes = await this.#db.batch([batches2[0], ...batches2.slice(1)]);
        const flattenedStats = statsRes.flat();

        const gameMap = new Map<number, Map<string, Map<string, SteamUserAchievementRawStats>>>();

        for (const row of flattenedStats) {
            const appId = row.app_id;
            if (!gameMap.has(appId)) {
                gameMap.set(appId, new Map());
            }
            const userMap = gameMap.get(appId);
            if (!userMap) continue;

            if (!userMap.has(row.user_id)) {
                userMap.set(row.user_id, new Map());
            }
            const userAchievements = userMap.get(row.user_id);
            if (!userAchievements) continue;

            for (const achievement of row.data ?? []) {
                userAchievements.set(achievement.apiname, achievement);
            }

            userMap.set(row.user_id, userAchievements);
        }

        return gameMap;
    }

    async putUserAchievements(data: Awaited<ReturnType<typeof this.getUserAchievements>>) {
        const values = new Array<InferSelectModel<typeof userAchievements>>();
        for (const [appId, userMap] of data.entries()) {
            for (const [userId, achievements] of userMap.entries()) {
                values.push({
                    app_id: appId,
                    user_id: userId,
                    data: [...achievements.values()],
                    updated_at: new Date(),
                });
            }
        }

        for (let i = 0; i < values.length; i += 20) {
            const chunk = values.slice(i, i + 20);
            await this.#db
                .insert(userAchievements)
                .values(chunk)
                .onConflictDoUpdate({
                    target: [userAchievements.app_id, userAchievements.user_id],
                    set: { updated_at: new Date(), data: sql`excluded.data` },
                });
        }
    }

    async getGameAchievements(appId: number[], lang: Language = "english") {
        const chunkSize = 20;

        // Group the cross product pairs into chunks
        const batchedGameIds: number[][] = [];
        for (let i = 0; i < appId.length; i += chunkSize) {
            batchedGameIds.push(appId.slice(i, i + chunkSize));
        }

        const batches2 = batchedGameIds.map((ids) =>
            this.#db
                .select({
                    achievements_stats: getTableAliasedColumns(achievementsStats),
                    achievements_meta: getTableAliasedColumns(achievementsMeta),
                })
                .from(achievementsStats)
                .leftJoin(
                    achievementsMeta,
                    and(eq(achievementsStats.app_id, achievementsMeta.app_id), eq(achievementsMeta.lang, lang)),
                )
                .where(inArray(achievementsStats.app_id, ids)),
        );

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

        if (!batches2[0]) return gameOutput;
        const statsRes = await this.#db.batch([batches2[0], ...batches2.slice(1)]);
        const flattenedStats = statsRes.flat(1).map((row) => ({
            ...row,
            achievements_stats: {
                ...row.achievements_stats,
                // @ts-ignore
                data: JSON.parse(row.achievements_stats.data) as SteamAchievementRawGlobalStats[],
            },
            achievements_meta: {
                ...row.achievements_meta,
                // @ts-ignore
                data: JSON.parse(row.achievements_meta.data) as SteamAchievementRawMeta[],
            },
        }));

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

    async putGameAchievements(data: Awaited<ReturnType<typeof this.getGameAchievements>>, lang: Language = "english") {
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

        const metaRecords = [
            ...data.entries().map(([app_id, gameMap]) => {
                const dataArr = [...gameMap.values()].map((achievements) => achievements.meta);
                return {
                    app_id,
                    lang,
                    data: dataArr,
                };
            }),
        ];
        const globalRecords = [
            ...data.entries().map(([app_id, gameMap]) => {
                const dataArr = [...gameMap.values()].map((achievements) => achievements.global);
                return {
                    app_id,
                    lang,
                    data: dataArr,
                };
            }),
        ];

        const chunkSize = 20; // adjust based on SQL parameter limits

        // Batch upsert for meta records: conflict target is (app_id, lang)
        for (let i = 0; i < metaRecords.length; i += chunkSize) {
            const chunk = metaRecords.slice(i, i + chunkSize);
            await this.#db
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
            await this.#db
                .insert(achievementsStats)
                .values(chunk)
                .onConflictDoUpdate({
                    target: [achievementsStats.app_id],
                    set: { updated_at: new Date(), data: sql`excluded.data` },
                });
        }
    }

    async getFriends(userId: string[]) {
        const res = await this.#db.select().from(friends).where(inArray(friends.user_id, userId));

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

    async putFriends(data: Awaited<ReturnType<typeof this.getFriends>>) {
        const map = [...data.entries()].map(([userId, friends]) => ({
            user_id: userId,
            data: friends,
        }));
        await this.#db
            .insert(friends)
            .values(map)
            .onConflictDoUpdate({
                target: friends.user_id,
                set: { updated_at: new Date(), data: sql`excluded.data` },
            });
    }
}

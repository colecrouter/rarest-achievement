import { getRequestEvent } from "$app/server";
import type { Language } from "$lib/server/api/lang";
import { SteamAPIRepository } from "$lib/server/api/repo";
import { SteamCacheDBRepository } from "$lib/server/db/repo";
import { Errable } from "$lib/error";
import { SteamApp } from "$lib/steam/data/SteamApp";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
import { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame";
import { SteamUser } from "$lib/steam/data/SteamUser";
import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";

/**
 * EnhancedSteamRepository is a class that provides methods to interact with the Steam API and cache.
 * It handles fetching, caching, and upserting data related to Steam applications, users, achievements, and friends.
 *
 * It should be used in a server-side context where the Steam API and cache are available.
 *
 * It is what should be used in the website layer, as opposed to any other classes.
 */
export class EnhancedSteamRepository {
    #apiRepository: SteamAPIRepository;
    #cacheRepository: SteamCacheDBRepository;

    constructor(locals?: App.Locals) {
        let l = locals;
        if (!l) {
            l = getRequestEvent()?.locals;
        }
        if (!l) {
            throw new Error("No locals provided");
        }

        this.#apiRepository = SteamAPIRepository.fromLocals(l);
        this.#cacheRepository = SteamCacheDBRepository.fromLocals(l);
    }

    async getApps(app: Array<number | SteamOwnedGame | SteamApp>) {
        const appIds = app.map((game) => (typeof game === "number" ? game : game.id));
        const { data: apps, error: err } = await fetchAndUpsert(
            [appIds],
            (_) => this.#cacheRepository.getApps(_),
            (_) => this.#cacheRepository.putApps(_),
            (_) => this.#apiRepository.getApps(_),
        );

        const steamApps = new Map<number, SteamApp>();
        for (const [, app] of apps) {
            if (!app) continue;
            const steamApp = new SteamApp(app);
            steamApps.set(steamApp.id, steamApp);
        }
        return new Errable(steamApps, err);
    }

    async getUsers(steamId: string[]) {
        const { data: players, error: err } = await fetchAndUpsert(
            [steamId],
            (_) => this.#cacheRepository.getUsers(_),
            (_) => this.#cacheRepository.putUsers(_),
            (_) => this.#apiRepository.getUsers(_),
        );

        const users = new Map<string, SteamUser>();
        for (const [_, player] of players) {
            const user = new SteamUser(player);
            users.set(user.id, user);
        }
        return new Errable(users, err);
    }

    async getUserAchievements(
        games: Array<number | SteamApp | SteamOwnedGame>,
        user: Array<string | SteamUser>,
        lang: Language = "english",
    ) {
        const gameIds = games.map((game) => (typeof game === "number" ? game : game.id));
        const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));

        const { data: userAchievements, error: err1 } = await fetchAndUpsert(
            [gameIds, userIds],
            (_, __) => this.#cacheRepository.getUserAchievements(_, __),
            (_) => this.#cacheRepository.putUserAchievements(_),
            (_, __) => this.#apiRepository.getUserAchievements(_, __),
        );

        const { data: gameAchievements, error: err2 } = await fetchAndUpsert(
            [gameIds],
            (_) => this.#cacheRepository.getGameAchievements(_),
            (_) => this.#cacheRepository.putGameAchievements(_),
            (_) => this.#apiRepository.getGameAchievements(_),
        );

        // Because we can pass in ids instead of just SteamApp objects, we need to fetch the games again if we don't have them
        let newGames: SteamApp[];
        let err3: Error | null = null;
        if (games[0] instanceof SteamApp) {
            newGames = games as SteamApp[];
        } else {
            const gameIds = games.map((game) => (typeof game === "number" ? game : game.id));
            const { data: gameApps, error: err } = await this.getApps(gameIds);
            newGames = [...gameApps.values()];
            err3 = err;
        }

        const achievements = new Map<number, Map<string, Map<string, SteamUserAchievement>>>();
        // New loop: use gameAchievements as base and iterate over each provided user.
        for (const [gameId, gameAchMap] of gameAchievements) {
            const gameData = newGames.find((game) => game.id === gameId);
            if (!gameData) continue;
            for (const u of userIds) {
                if (!achievements.has(gameId)) {
                    achievements.set(gameId, new Map());
                }
                if (!achievements.get(gameId)?.has(u)) {
                    achievements.get(gameId)?.set(u, new Map());
                }
                for (const [achievementId, { global, meta }] of gameAchMap) {
                    // Check user's achievement data; pass null if missing.
                    const userAchData = userAchievements.get(gameId)?.get(u)?.get(achievementId) || null;
                    const userAchievement = new SteamUserAchievement(gameData, u, meta, global, userAchData, lang);
                    achievements.get(gameId)?.get(u)?.set(achievementId, userAchievement);
                }
            }
        }

        return new Errable(achievements, err1 ?? err2 ?? err3);
    }

    async getOwnedGames(user: Array<string | SteamUser>) {
        const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));
        const { data: games, error: err } = await fetchAndUpsert(
            [userIds],
            (_) => this.#cacheRepository.getOwnedGames(_),
            (_) => this.#cacheRepository.putOwnedGames(_),
            (_) => this.#apiRepository.getOwnedGames(_),
        );
        const ownedGames = new Map<string, SteamOwnedGame[]>();
        for (const [userId, game] of games) {
            const userOwnedGames = new Array<SteamOwnedGame>();
            for (const ownedGame of game) {
                const steamOwnedGame = new SteamOwnedGame(ownedGame);
                userOwnedGames.push(steamOwnedGame);
            }
            ownedGames.set(userId, userOwnedGames);
        }
        return new Errable(ownedGames, err);
    }

    async getGameAchievements(game: SteamApp[], lang: Language = "english") {
        const gameIds = game.map((game) => (game instanceof SteamOwnedGame ? game.id : game.id));
        const { data: gameAchievementsRaw, error: err } = await fetchAndUpsert(
            [gameIds],
            (_) => this.#cacheRepository.getGameAchievements(_),
            (_) => this.#cacheRepository.putGameAchievements(_),
            (_) => this.#apiRepository.getGameAchievements(_),
        );

        const mappedGameAchievements = new Map<number, Map<string, SteamAppAchievement>>();
        for (const [gameId, achievementsMap] of gameAchievementsRaw) {
            const gameAchievementsMap = new Map<string, SteamAppAchievement>();

            const gameData = game.find((game) => game.id === gameId);
            if (!gameData) continue;

            for (const [achievementId, { global, meta }] of achievementsMap) {
                const gameAchievement = new SteamAppAchievement(gameData, meta, global, lang);
                gameAchievementsMap.set(achievementId, gameAchievement);
            }
            if (gameData) mappedGameAchievements.set(gameId, gameAchievementsMap);
        }

        return new Errable(mappedGameAchievements, err);
    }

    async getFriends(user: SteamUser[]) {
        const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));
        const { data: userIdFriendIdMap, error: err1 } = await fetchAndUpsert(
            [userIds],
            (_) => this.#cacheRepository.getFriends(_),
            (_) => this.#cacheRepository.putFriends(_),
            (_) => this.#apiRepository.getFriends(_),
        );

        const friendIds = [...userIdFriendIdMap.values()].flat().map((user) => user.steamid);
        const { data: friendMap, error: err2 } = await fetchAndUpsert(
            [friendIds],
            (_) => this.#cacheRepository.getUsers(_),
            (_) => this.#cacheRepository.putUsers(_),
            (_) => this.#apiRepository.getUsers(_),
        );
        const friendUsers = new Map(
            [...friendMap.entries()].map(([_, user]) => {
                const steamUser = new SteamUser(user);
                return [steamUser.id, steamUser];
            }),
        );

        // Match the users back into their original friends list
        const friendsList = new Map<string, SteamUser[]>();
        for (const [userId, friends] of userIdFriendIdMap) {
            const users = friends.map((f) => friendUsers.get(f.steamid)).filter((user) => !!user);

            friendsList.set(userId, users);
        }

        return new Errable(friendsList, err1 ?? err2);
    }
}

// This helper type recursively builds nested maps from an array tuple.
type NestedMap<T extends unknown[]> = T extends [infer Head, ...infer Tail]
    ? Head extends Array<infer U>
        ? Map<U, Tail extends [] ? unknown : NestedMap<Tail>>
        : unknown
    : unknown;

// Add debug to compare expected keys and map keys
function debugCompareKeys<T>(expectedKeys: T[], map: Map<T, unknown>, label: string): void {
    const missingKeys = expectedKeys.filter((key) => !map.has(key));
    if (missingKeys.length) console.debug(`${label} - Missing keys:`, missingKeys);
}

/**
 * For a 1D map, return the keys that are missing.
 *
 * @param expectedKeys - Array of the expected keys
 * @param data - The Map from the DB
 * @param debugLabel - An optional label for debugging
 * @returns An array of missing keys
 */
function getMissingKeys1D<T>(expectedKeys: T[], data: Map<T, unknown>, debugLabel = "1D Map"): T[] {
    debugCompareKeys(expectedKeys, data, debugLabel);
    const expectedSet = new Set(expectedKeys);
    const dataKeysSet = new Set(data.keys());
    return Array.from(expectedSet.difference(dataKeysSet));
}

/**
 * For a 2D map, return which outer keys are missing entirely and,
 * for those present, which inner keys are missing.
 * Reuses getMissingKeys1D for both the outer and inner comparisons.
 *
 * @param expectedOuter - Array of expected outer keys
 * @param expectedInner - Array of expected inner keys
 * @param data - The 2D Map
 * @returns An object with missing outer keys and a map of missing inner keys.
 */
function getMissingKeys2D<TOuter, TInner>(
    expectedOuter: TOuter[],
    expectedInner: TInner[],
    data: Map<TOuter, Map<TInner, unknown>>,
): { missingOuter: TOuter[]; missingInner: TInner[] } {
    const missingOuterSet = new Set<TOuter>();
    const missingInnerMap = new Map<TOuter, TInner[]>();

    for (const outer of expectedOuter) {
        const innerMap = data.get(outer);
        if (!innerMap) {
            // Outer key entirely missing.
            missingOuterSet.add(outer);
        } else {
            const missingForOuter = expectedInner.filter((key) => !innerMap.has(key));
            if (missingForOuter.length > 0) {
                missingOuterSet.add(outer);
                missingInnerMap.set(outer, missingForOuter);
            }
        }
    }

    const missingOuter = [...missingOuterSet];
    const missingInner = [...new Set([...missingInnerMap.values()].flat())];

    return { missingOuter, missingInner };
}

// New helper type to extract the missing-keys portion from TArgs.
type MissingArgs<T extends unknown[]> = T extends [infer Outer, infer Inner, ...infer _Rest]
    ? [Outer, Inner]
    : T extends [infer Outer, ...infer _Rest]
      ? [Outer]
      : T;

/**
 * Generic function to fetch and upsert data.
 *
 * If TArgs[0] (or TArgs[1] for a 2D map) is an array, they will be
 * interpreted as the list of expected keys for the cache. If TArgs contains
 * other types (e.g., configurations, filters) they will be ignored in the
 * missing-data logic.
 *
 * @param args - The arguments required for fetching data.
 *               If the first element is an array, it's considered as the keys
 *               for a Map. If the second element is an array, it's used for 2D
 *               maps.
 * @param getFromDB  - Function to retrieve data from the DB/cache.
 * @param upsertDB   - Function to upsert new data into the DB/cache.
 * @param fetchFromAPI - Function to fetch missing data from the API.
 * @returns The complete data, with missing pieces fetched and upserted.
 */
async function fetchAndUpsert<
    TArgs extends unknown[],
    TResult extends TArgs[0] extends Array<unknown> ? NestedMap<TArgs> : never,
>(
    args: [...TArgs],
    getFromDB: (...args: TArgs) => Promise<TResult>,
    upsertDB: (data: TResult) => Promise<void>,
    fetchFromAPI: (...args: TArgs) => Promise<Errable<TResult>>,
): Promise<Errable<TResult>> {
    // Attempt to get data from the DB (or cache)
    let accumulatedData = await getFromDB(...args);
    let error: Error | null = null;

    // Adjust upsertMissingData to require missingArgs of type MissingArgs<TArgs>.
    async function upsertMissingData(errorContext: string, missingArgs: MissingArgs<TArgs>): Promise<Errable<TResult>> {
        const result = await fetchFromAPI(...(missingArgs as TArgs));
        await upsertDB(result.data);
        if (result.error) {
            console.error(`Error fetching ${errorContext} data:`, result.error);
        }
        return result;
    }

    // If the expected keys are passed (as first argument) and the data is a Map,
    // then check for missing keys.
    if (Array.isArray(args[0]) && accumulatedData instanceof Map) {
        const expectedOuter = args[0] as unknown[];

        // 2D map case: Check if the second argument is an array and all values in
        // the Map are also Maps.
        if (args.length > 1 && Array.isArray(args[1]) && [...accumulatedData.values()].every((v) => v instanceof Map)) {
            const expectedInner = args[1];
            const { missingOuter, missingInner } = getMissingKeys2D(expectedOuter, expectedInner, accumulatedData);
            if (missingOuter.length > 0 || missingInner.length > 0) {
                // Call using the computed missing keys.
                const missing = [missingOuter, missingInner] as MissingArgs<TArgs>;
                const result = await upsertMissingData("2D", missing);
                if (result.error) {
                    error = result.error;
                }

                accumulatedData = result.data;
            }
        } else {
            // 1D map case.
            // console.log("1D map case", data);
            const missingKeys = getMissingKeys1D(expectedOuter, accumulatedData);
            if (missingKeys.length > 0) {
                const result = await upsertMissingData("1D", [missingKeys] as MissingArgs<TArgs>);
                if (result.error) {
                    error = result.error;
                }
                accumulatedData = result.data;
            }
        }
    } else if (!accumulatedData) {
        // For non-Map data, pass the full args.
        const result = await upsertMissingData("non-map", args as MissingArgs<TArgs>);
        if (result.error) {
            error = result.error;
        }
        accumulatedData = result.data;
    }

    return new Errable(accumulatedData, error); // Return the final data and error
}

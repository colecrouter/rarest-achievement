import { type ProjectDB, SteamStoreAPIClient } from "..";
import { Errable } from "../../error";
import { estimatePlayerCount } from "../../ml/playerEstimate";
import { SteamApp, SteamAppAchievement, SteamOwnedGame, SteamUser, SteamUserAchievement } from "../../models";
import type { Language } from "../api/lang";
import { SteamAPIRepository } from "../api/repo";
import { SteamChartsAPIClient } from "../api/steamcharts/client";
import type { SteamAuthenticatedAPIClient } from "../api/steampowered/client";
import { SteamCacheDBRepository } from "../db/repo";
import { fetchAndUpsert } from "./merge";

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

    constructor(locals: {
        steamClient: SteamAuthenticatedAPIClient;
        steamCacheDB: ProjectDB;
    }) {
        this.#apiRepository = new SteamAPIRepository(locals.steamClient);
        this.#cacheRepository = new SteamCacheDBRepository(locals.steamCacheDB);
    }

    async getApps(app: Array<number | SteamOwnedGame | SteamApp>) {
        const appIds = app.map((game) => (typeof game === "number" ? game : game.id));

        const { data: apps, error: err } = await fetchAndUpsert(
            [appIds],
            (_) => this.#cacheRepository.getApps(_),
            (_) => this.#cacheRepository.putApps(_),
            (_) => this.#apiRepository.getApps(_),
        );

        const { data: estimatedPlayers, error: err2 } = await fetchAndUpsert(
            [appIds],
            (_) => this.#cacheRepository.getEstimatedPlayers(_),
            (_) => this.#cacheRepository.putEstimatedPlayers(_),
            (_) => this.getEstimatedPlayers(_),
        );

        const steamApps = new Map<number, SteamApp>();
        for (const [id, app] of apps) {
            if (!app) continue;
            const estimatedPlayer = estimatedPlayers.get(id);
            // if (!estimatedPlayer) continue; // SteamCharts appears to be missing data for some apps

            const steamApp = new SteamApp(app.steam_appid, app, estimatedPlayer ?? null);
            steamApps.set(steamApp.id, steamApp);
        }
        return new Errable(steamApps, err ?? err2);
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

        const gameIds = games.map((game) => (typeof game === "number" ? game : game.id));
        const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));

        const { data: userAchievements, error: err1 } = await fetchAndUpsert<
            number,
            string,
            Map<
                string,
                {
                    apiname: string;
                    achieved: number;
                    unlocktime: number;
                }
            >
        >(
            [gameIds, userIds, undefined],
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

        if (err1 ?? err2 ?? err3) {
            console.error("Error fetching user achievements:", err1, err2, err3);
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

    async getEstimatedPlayers(appId: number[], lang: Language = "english") {
        const data = new Map<number, number | null>();

        return Errable.try(async (setError) => {
            const appDetails = await fetchAndUpsert(
                [appId],
                (_) => this.#cacheRepository.getApps(_),
                (_) => this.#cacheRepository.putApps(_),
                (_) => this.#apiRepository.getApps(_),
            );

            for (const id of appId) {
                const [appReviews, appPlayerCount] = await Promise.all([
                    // SteamStoreAPIClient.getAppDetails<undefined>(id, { l: lang }),
                    SteamStoreAPIClient.getAppReviews(id, { num_per_page: "0" }),
                    SteamChartsAPIClient.getAppChartData(id),
                ]);

                const appData = appDetails.data.get(id);

                if (!appData || !appReviews || !appPlayerCount) {
                    data.set(id, null);
                    continue;
                }

                const estimatedPlayers = estimatePlayerCount({
                    all_time_peak: appPlayerCount.reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                    avg_count: appPlayerCount.reduce((acc, curr) => acc + curr[1], 0) / appPlayerCount.length,
                    day_peak: appPlayerCount
                        .filter((curr) => curr[0] > Date.now() / 1000 - 60 * 60 * 24)
                        .reduce((acc, curr) => Math.max(acc, curr[1]), 0),
                    release_date_numeric: new Date(appData.release_date?.date ?? 0).getTime() / 1000,
                    review_score: appReviews.query_summary.review_score,
                    total_reviews: appReviews.query_summary.total_reviews,
                    is_free: appData.is_free ? 1 : 0,
                    price: appData.price_overview?.final ?? 0,
                });

                data.set(id, estimatedPlayers);
            }

            if (data.size !== appId.length) setError(new Error("Not all apps were found."));

            return data;
        });
    }
}

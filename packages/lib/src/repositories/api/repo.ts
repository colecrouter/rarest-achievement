import { Errable } from "../../error";
import type {
    SteamAchievementRawGlobalStats,
    SteamAchievementRawMeta,
    SteamAppRaw,
    SteamFriendsListRaw,
    SteamUserAchievementRawStats,
    SteamUserRaw,
} from "../../models";
import type { Language } from "../../repositories/api/lang";
import type { SteamAuthenticatedAPIClient } from "../../repositories/api/steampowered/client";
import type { OwnedGame } from "../../repositories/api/steampowered/owned";
import { SteamStoreAPIClient } from "../../repositories/api/store/client";

/**
 * Repository for fetching data from the Steam API.
 * This class is responsible for making API calls to the Steam API and returning the results.
 *
 * Does not contain any caching logic.
 * It is not meant to be used directly, but rather with the EnhancedRepo class.
 */
export class SteamAPIRepository {
    #apiClient: SteamAuthenticatedAPIClient;

    constructor(steamClient: SteamAuthenticatedAPIClient) {
        this.#apiClient = steamClient;
    }

    async getApps(app_id: number[], lang: Language = "english") {
        const data = new Map<number, SteamAppRaw | null>();
        let error: Error | null = null;

        try {
            const chunkSize = 5;
            for (let i = 0; i < app_id.length; i += chunkSize) {
                const chunk = app_id.slice(i, i + chunkSize);
                await Promise.all(
                    chunk.map(async (appId) => {
                        const appDetails = await SteamStoreAPIClient.getAppDetails<undefined>(appId, {
                            l: lang,
                        });
                        const appData = appDetails?.[appId];
                        if (!appData?.data) return data.set(appId, null);

                        data.set(appId, appData.data);
                    }),
                );
            }
        } catch (e) {
            error = e as Error;
        }

        return new Errable(data, error);
    }

    async getUsers(user_id: string[]) {
        let result = new Map<string, SteamUserRaw>();
        let error: Error | null = null;

        try {
            const { response } = await this.#apiClient.getPlayerSummaries(user_id);
            result = new Map(response.players.map((user) => [user.steamid, user]));
        } catch (e) {
            error = e as Error;
        }

        return new Errable(result, error);
    }

    async getOwnedGames(user_id: string[]) {
        const data = new Map<string, OwnedGame<false>[]>();
        let error: Error | null = null;

        try {
            await Promise.all(
                user_id.map(async (steamId) => {
                    const res = await this.#apiClient.getOwnedGames({
                        steamid: steamId,
                        include_played_free_games: true,
                    });
                    if (res && "games" in res.response && res.response.games) {
                        data.set(steamId, res.response.games);
                    } else {
                        data.set(steamId, []);
                    }
                }),
            );
        } catch (e) {
            error = e as Error;
        }

        return new Errable(data, error);
    }

    async getUserAchievements(game_id: number[], user_id: string[]) {
        const data = new Map<number, Map<string, Map<string, SteamUserAchievementRawStats>>>();
        let error: Error | null = null;

        try {
            // As an intermediary rate limit, if the number of resources exceeds 100, we will limit it
            const cappedUserIds = new Array<string>();
            for (let i = 0; i < user_id.length; i++) {
                const usr = user_id[i];
                if (usr) cappedUserIds.push(usr);
                if (cappedUserIds.length * game_id.length + game_id.length > 100) break;
            }

            await Promise.all(
                game_id.map(async (gameId) => {
                    const userAchievements = new Map<string, Map<string, SteamUserAchievementRawStats>>();
                    await Promise.all(
                        cappedUserIds.map(async (steamId) => {
                            const res = await this.#apiClient.getPlayerAchievements({
                                steamid: steamId,
                                appid: gameId,
                            });
                            const achievementsMap = new Map<string, SteamUserAchievementRawStats>();
                            if (res?.playerstats?.achievements) {
                                for (const achievement of res.playerstats.achievements) {
                                    achievementsMap.set(achievement.apiname, achievement);
                                }
                            }
                            userAchievements.set(steamId, achievementsMap);
                        }),
                    );
                    data.set(gameId, userAchievements);
                }),
            );

            if (cappedUserIds.length < user_id.length) throw new Error("Too many user IDs to fetch achievements for.");
        } catch (e) {
            error = e as Error;
        }

        return new Errable(data, error);
    }

    async getGameAchievements(game_id: number[], lang: Language = "english") {
        const data = new Map<
            number,
            Map<
                string,
                {
                    meta: SteamAchievementRawMeta;
                    global: SteamAchievementRawGlobalStats;
                }
            >
        >();
        let error: Error | null = null;

        try {
            const validSchemas = new Map<number, Map<string, SteamAchievementRawMeta>>();
            await Promise.all(
                game_id.map(async (id) => {
                    const schema = await this.#apiClient.getSchemaForGame({
                        appid: id,
                        l: lang,
                    });
                    if (!schema) return;
                    const achievements = schema.game.availableGameStats?.achievements;
                    if (!achievements) return;
                    validSchemas.set(id, new Map<string, SteamAchievementRawMeta>());
                    for (const achievement of achievements) {
                        validSchemas.get(id)?.set(achievement.name, achievement);
                    }
                }),
            );

            await Promise.all(
                game_id.map(async (gameId) => {
                    const metaMap = validSchemas.get(gameId);
                    const percentages = await this.#apiClient.getGlobalAchievementPercentagesForApp({
                        gameid: gameId,
                    });
                    const globalMap = new Map<string, SteamAchievementRawGlobalStats>();
                    for (const achievement of percentages?.achievementpercentages.achievements ?? []) {
                        globalMap.set(achievement.name, achievement);
                    }
                    const achievementsMap = new Map<
                        string,
                        {
                            meta: SteamAchievementRawMeta;
                            global: SteamAchievementRawGlobalStats;
                        }
                    >();
                    for (const [name, meta] of metaMap ?? []) {
                        const global = globalMap.get(name);
                        if (global) {
                            achievementsMap.set(name, { meta, global });
                        }
                    }
                    data.set(gameId, achievementsMap);
                }),
            );
        } catch (e) {
            error = e as Error;
        }

        return new Errable(data, error);
    }

    async getFriends(user_id: string[]) {
        const data = new Map<string, SteamFriendsListRaw>();
        let error: Error | null = null;

        try {
            await Promise.all(
                user_id.map(async (steamId) => {
                    const { friendslist } = await this.#apiClient.getFriendsList({
                        steamid: steamId,
                        relationship: "friend",
                    });
                    if (friendslist.friends) {
                        data.set(steamId, friendslist.friends);
                    }
                }),
            );
        } catch (e) {
            error = e as Error;
        }

        return new Errable(data, error);
    }
}

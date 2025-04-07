import { browser } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { Language } from "$lib/server/api/lang";
import type { OwnedGame } from "$lib/server/api/steampowered/owned";
import type { Errable } from "$lib/server/fetchAndUpsert";
import type { SteamAppRaw } from "$lib/steam/data/SteamApp";
import type { SteamAchievementRawGlobalStats, SteamAchievementRawMeta } from "$lib/steam/data/SteamAppAchievement";
import type { SteamFriendsListRaw } from "$lib/steam/data/SteamFriendsList";
import type { SteamUserRaw } from "$lib/steam/data/SteamUser";
import type { SteamUSerAchievementRawStats } from "$lib/steam/data/SteamUserAchievement";

export async function getSteamUsersAPI(user_id: string[]): Errable<Map<string, SteamUserRaw>> {
    try {
        if (browser) throw new Error("Cannot fetch user in a browser context.");
        const { locals } = getRequestEvent();
        const { steamClient } = locals;
        const { response } = await steamClient.getPlayerSummaries(user_id);
        const result = new Map(response.players.map((user) => [user.steamid, user]));
        return [result, null];
    } catch (error) {
        return [new Map<string, SteamUserRaw>(), error as Error];
    }
}

export async function getSteamAppsAPI(
    app_id: number[],
    lang: Language = "english",
): Errable<Map<number, SteamAppRaw | null>> {
    const data = new Map<number, SteamAppRaw | null>();

    try {
        if (browser) throw new Error("Cannot fetch Steam app details in a browser context.");
        const { locals } = getRequestEvent();
        const { steamStoreClient } = locals;
        const chunkSize = 5;
        for (let i = 0; i < app_id.length; i += chunkSize) {
            const chunk = app_id.slice(i, i + chunkSize);
            await Promise.all(
                chunk.map(async (appId) => {
                    try {
                        const appDetails = await steamStoreClient.getAppDetails<undefined>(appId, { l: lang });
                        const appData = appDetails?.[appId];
                        if (appData?.success === false) {
                            data.set(appId, null);
                        } else {
                            data.set(appId, appData?.data ?? null);
                        }
                    } catch (error) {
                        console.error(`Error fetching app ${appId}:`, error);
                        data.set(appId, null);
                    }
                }),
            );
        }
        return [data, null];
    } catch (error) {
        return [data, error as Error];
    }
}

export async function getOwnedSteamGamesAPI(user_id: string[]): Errable<Map<string, OwnedGame<false>[]>> {
    const data = new Map<string, OwnedGame<false>[]>();

    try {
        if (browser) throw new Error("Cannot fetch owned game in a browser context.");
        const { locals } = getRequestEvent();
        const { steamClient } = locals;
        await Promise.all(
            user_id.map(async (steamId) => {
                const res = await steamClient.getOwnedGames({
                    steamid: steamId,
                    include_played_free_games: true,
                });
                if (res?.response.games) {
                    data.set(steamId, res.response.games);
                }
            }),
        );
        return [data, null];
    } catch (error) {
        return [data, error as Error];
    }
}

export async function getSteamUserAchievementsAPI(
    game_id: number[],
    user_id: string[],
    lang: Language = "english",
): Errable<
    Map<
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
    >
> {
    const data = new Map<
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

    try {
        if (browser) throw new Error("Cannot fetch user achievements in a browser context.");
        const { steamClient } = getRequestEvent().locals;
        const validSchemas = new Map<number, Map<string, SteamAchievementRawMeta>>();
        await Promise.all(
            game_id.map(async (id) => {
                try {
                    const schema = await steamClient.getSchemaForGame({ appid: id, l: lang });
                    if (!schema) return;
                    const achievements = schema.game.availableGameStats?.achievements;
                    if (!achievements) return;
                    validSchemas.set(id, new Map<string, SteamAchievementRawMeta>());
                    for (const achievement of achievements) {
                        validSchemas.get(id)?.set(achievement.name, achievement);
                    }
                } catch (error) {
                    console.error(`Error fetching schema for game ${id}:`, error);
                }
            }),
        );
        await Promise.all(
            validSchemas.entries().map(async ([gameId, meta]) => {
                const validAchievements = new Map<string, SteamAchievementRawGlobalStats>();
                const percentages = await steamClient.getGlobalAchievementPercentagesForApp({ gameid: gameId });
                if (!percentages) return null;
                for (const achievement of percentages.achievementpercentages.achievements) {
                    validAchievements.set(achievement.name, achievement);
                }
                const userOutput = new Map<
                    string,
                    Map<
                        string,
                        {
                            meta: SteamAchievementRawMeta;
                            global: SteamAchievementRawGlobalStats;
                            userStats: SteamUSerAchievementRawStats | null;
                        }
                    >
                >();
                await Promise.all(
                    user_id.map(async (id) => {
                        const userAchievements = await steamClient.getPlayerAchievements({
                            steamid: id,
                            appid: gameId,
                            l: lang,
                        });
                        if (!userAchievements) return null;
                        const achieveMap = new Map<
                            string,
                            {
                                meta: SteamAchievementRawMeta;
                                global: SteamAchievementRawGlobalStats;
                                userStats: SteamUSerAchievementRawStats | null;
                            }
                        >();
                        for (const achievement of userAchievements.playerstats.achievements) {
                            const metaValue = validSchemas.get(gameId)?.get(achievement.apiname);
                            const global = validAchievements.get(achievement.apiname);
                            if (!metaValue || !global) continue;
                            achieveMap.set(achievement.apiname, {
                                meta: metaValue,
                                global,
                                userStats: achievement,
                            });
                        }
                        userOutput.set(id, achieveMap);
                    }),
                );
                data.set(gameId, userOutput);
            }),
        );
        return [data, null];
    } catch (error) {
        return [data, error as Error];
    }
}

export async function getSteamGameAchievementsAPI(
    game_id: number[],
    lang: Language = "english",
): Errable<Map<number, Map<string, { meta: SteamAchievementRawMeta; global: SteamAchievementRawGlobalStats }>>> {
    const data = new Map<
        number,
        Map<string, { meta: SteamAchievementRawMeta; global: SteamAchievementRawGlobalStats }>
    >();

    try {
        if (browser) throw new Error("Cannot fetch game achievements in a browser context.");
        const { steamClient } = getRequestEvent().locals;
        const validSchemas = new Map<number, Map<string, SteamAchievementRawMeta>>();
        await Promise.all(
            game_id.map(async (id) => {
                const schema = await steamClient.getSchemaForGame({ appid: id, l: lang });
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
            Array.from(validSchemas.entries()).map(async ([gameId, metaMap]) => {
                const percentages = await steamClient.getGlobalAchievementPercentagesForApp({ gameid: gameId });
                if (!percentages) return;
                const globalMap = new Map<string, SteamAchievementRawGlobalStats>();
                for (const achievement of percentages.achievementpercentages.achievements) {
                    globalMap.set(achievement.name, achievement);
                }
                const achievementsMap = new Map<
                    string,
                    { meta: SteamAchievementRawMeta; global: SteamAchievementRawGlobalStats }
                >();
                metaMap.forEach((meta, name) => {
                    const global = globalMap.get(name);
                    if (global) {
                        achievementsMap.set(name, { meta, global });
                    }
                });
                data.set(gameId, achievementsMap);
            }),
        );
        return [data, null];
    } catch (error) {
        return [data, error as Error];
    }
}

export async function getSteamFriendsAPI(user_id: string[]): Errable<Map<string, SteamFriendsListRaw>> {
    const data = new Map<string, SteamFriendsListRaw>();

    try {
        if (browser) throw new Error("Cannot get friends in a browser context.");
        const { locals } = getRequestEvent();
        const { steamClient } = locals;
        await Promise.all(
            user_id.map(async (steamId) => {
                const { friendslist } = await steamClient.getFriendsList({
                    steamid: steamId,
                    relationship: "friend",
                });
                if (friendslist.friends) {
                    data.set(steamId, friendslist.friends);
                }
            }),
        );
        return [data, null];
    } catch (error) {
        return [data, error as Error];
    }
}

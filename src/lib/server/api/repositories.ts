import { browser } from "$app/environment";
import { getRequestEvent } from "$app/server";
import type { Language } from "$lib/server/api/lang";
import type { OwnedGame } from "$lib/server/api/steampowered/owned";
import type { SteamAppRaw } from "$lib/steam/data/SteamApp";
import type { SteamAchievementRawGlobalStats, SteamAchievementRawMeta } from "$lib/steam/data/SteamAppAchievement";
import type { SteamFriendsListRaw } from "$lib/steam/data/SteamFriendsList";
import type { SteamUSerAchievementRawStats } from "$lib/steam/data/SteamUserAchievement";

export async function getSteamUsersAPI(user_id: string[]) {
    if (browser) throw new Error("Cannot fetch user in a browser context.");
    const { locals } = getRequestEvent();
    const { steamClient } = locals;
    const { response } = await steamClient.getPlayerSummaries(user_id);

    return new Map(response.players.map((user) => [user.steamid, user]));
}

export async function getSteamAppsAPI(app_id: number[], lang: Language = "english") {
    if (browser) throw new Error("Cannot fetch Steam app details in a browser context.");
    const { locals } = getRequestEvent();
    const { steamStoreClient } = locals;

    // We cannot fetch multiple apps at once
    // So we need to fetch them one by one
    const data = new Map<number, SteamAppRaw | null>();

    // Not trying to do this concurrently, because it will hit the API limit
    // for (const appId of app_id) {
    //     const appDetails = await steamStoreClient.getAppDetails<undefined>(appId, { l: lang })
    //     const appData = appDetails?.[appId];
    //     if (appData?.success === false) continue;
    //     data.set(appId, appData?.data ?? null);
    // }

    // await Promise.all(
    //     app_id.map(async (appId) => {
    //         const appDetails = await steamStoreClient.getAppDetails<undefined>(appId, { l: lang });
    //         const appData = appDetails?.[appId];
    //         if (appData?.success === false) return; // NOTE TO SELF this allows for null values in the map. THIS IS INTENTIONAL
    //         data.set(appId, appData?.data ?? null);
    //     }),
    // );

    // OK let's try grouping them by 5 to reduce change of rate limiting
    // The rate limit fairly aggressive, at 200 requests per 5 minutes
    const chunkSize = 5;
    for (let i = 0; i < app_id.length; i += chunkSize) {
        const chunk = app_id.slice(i, i + chunkSize);
        await Promise.all(
            chunk.map(async (appId) => {
                const appDetails = await steamStoreClient.getAppDetails<undefined>(appId, { l: lang });
                const appData = appDetails?.[appId];
                if (appData?.success === false) return; // NOTE TO SELF this allows for null values in the map. THIS IS INTENTIONAL
                data.set(appId, appData?.data ?? null);
            }),
        );
    }

    return data;
}

export async function getOwnedSteamGamesAPI(user_id: string[]) {
    if (browser) throw new Error("Cannot fetch owned game in a browser context.");
    const { locals } = getRequestEvent();
    const { steamClient } = locals;

    const responses = new Map<string, OwnedGame<false>[]>();

    await Promise.all(
        user_id.map(async (steamId) => {
            const res = await steamClient.getOwnedGames({
                steamid: steamId,
                include_played_free_games: true,
            });
            if (res?.response.games) {
                responses.set(steamId, res.response.games);
            }
        }),
    );

    return responses;
}

export async function getSteamUserAchievementsAPI(game_id: number[], user_id: string[], lang: Language = "english") {
    if (browser) throw new Error("Cannot fetch user achievements in a browser context.");
    const { steamClient } = getRequestEvent().locals;

    // Game might not have a schema (I know a couple unreleased games don't have one)
    // Schemas contain the meta info for the achievements
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

    // We're doing this nested, so we can avoid having to manually merge in user data after
    await Promise.all(
        validSchemas.entries().map(async ([gameId, meta]) => {
            // Get the global achievement percentages for each game
            const validAchievements = new Map<string, SteamAchievementRawGlobalStats>();

            const percentages = await steamClient.getGlobalAchievementPercentagesForApp({ gameid: gameId });
            if (!percentages) return null;

            // Add the global achievement percentages to the map
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

            // Get the user achievements for each game
            await Promise.all(
                user_id.map(async (id) => {
                    const userAchievements = await steamClient.getPlayerAchievements({
                        steamid: id,
                        appid: gameId,
                        l: lang,
                    });
                    if (!userAchievements) return null;

                    // Finally, add all the data to the map
                    const achieveMap = new Map<
                        string,
                        {
                            meta: SteamAchievementRawMeta;
                            global: SteamAchievementRawGlobalStats;
                            userStats: SteamUSerAchievementRawStats | null;
                        }
                    >();
                    for (const achievement of userAchievements.playerstats.achievements) {
                        const meta = validSchemas.get(gameId)?.get(achievement.apiname);
                        const global = validAchievements.get(achievement.apiname);
                        if (!meta || !global) continue;

                        achieveMap.set(achievement.apiname, {
                            meta,
                            global,
                            userStats: achievement,
                        });
                    }

                    userOutput.set(id, achieveMap);
                }),
            );

            // Add the user achievements to the game output
            gameOutput.set(gameId, userOutput);
        }),
    );

    return gameOutput;
}

export async function getSteamGameAchievementsAPI(game_id: number[], lang: Language = "english") {
    if (browser) throw new Error("Cannot fetch game achievements in a browser context.");
    const { steamClient } = getRequestEvent().locals;

    // Build schemas for each game
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

    const output = new Map<
        number,
        Map<string, { meta: SteamAchievementRawMeta; global: SteamAchievementRawGlobalStats }>
    >();

    // For each game, fetch global achievement percentages and map valid achievements
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
            output.set(gameId, achievementsMap);
        }),
    );

    return output;
}

export async function getSteamFriendsAPI(user_id: string[]) {
    if (browser) throw new Error("Cannot get friends in a browser context.");

    const { locals } = getRequestEvent();

    const { steamClient } = locals;

    const responses = new Map<string, SteamFriendsListRaw>();
    await Promise.all(
        user_id.map(async (steamId) => {
            const { friendslist } = await steamClient.getFriendsList({
                steamid: steamId,
                relationship: "friend",
            });
            if (friendslist.friends) {
                responses.set(steamId, friendslist.friends);
            }
        }),
    );
    return responses;
}

import { browser } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { SteamApp } from "$lib/steam/data/SteamApp";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
import { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame";
import { SteamUser } from "$lib/steam/data/SteamUser";
import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";

export async function fetchUserAchievements(
    game: SteamApp | SteamOwnedGame,
    user: string | SteamUser,
    lang = "english",
) {
    if (browser) throw new Error("Cannot fetch user achievements in a browser context.");
    const { steamClient } = getRequestEvent().locals;
    const schema = await steamClient.getSchemaForGame({ appid: game.id, l: lang }).catch(() => null);
    if (!schema) return [];
    const achievementPercentages = await steamClient
        .getGlobalAchievementPercentagesForApp({ gameid: game.id })
        .catch(() => null);
    if (!achievementPercentages) return [];
    const userAchievements = await steamClient
        .getPlayerAchievements({ steamid: typeof user === "string" ? user : user.id, appid: game.id })
        .catch(() => null);
    if (!schema || !achievementPercentages) {
        throw new Error("Failed to fetch schema or achievement percentages.");
    }
    const stats = schema.game.availableGameStats?.achievements;
    if (!stats) return [];
    const achievements: SteamUserAchievement[] = [];
    for (const stat of stats) {
        const global = achievementPercentages.achievementpercentages.achievements.find(
            (achievement) => achievement.name === stat.name,
        );
        if (!global) throw new Error("No global achievement found.");
        const userStat = userAchievements?.playerstats.achievements.find(
            (achievement) => achievement.apiname === stat.name,
        );
        let app: SteamApp;
        if (game instanceof SteamOwnedGame) {
            app = await fetchSteamApp(game.id, lang);
        } else {
            app = game;
        }
        achievements.push(
            new SteamUserAchievement(
                app,
                typeof user === "string" ? user : user.id,
                stat,
                global,
                userStat ?? null,
                lang,
            ),
        );
    }
    return achievements;
}

export async function fetchUser(steamId: string) {
    if (browser) throw new Error("Cannot fetch user in a browser context.");
    const { locals } = getRequestEvent();
    const { steamClient } = locals;
    const { response } = await steamClient.getPlayerSummaries([steamId]);
    if (response.players.length === 0) {
        return null;
    }
    return new SteamUser(response.players[0]);
}

export async function fetchOwnedGames(user: string | SteamUser) {
    if (browser) throw new Error("Cannot fetch owned game in a browser context.");
    const { locals } = getRequestEvent();
    const { steamClient } = locals;
    const { response } = await steamClient.getOwnedGames({
        steamid: typeof user === "string" ? user : user.id,
        include_appinfo: true,
        include_played_free_games: true,
    });
    if (!response.game_count) return [];
    const { games } = response;
    return games?.map((game) => new SteamOwnedGame(game)) ?? [];
}

export async function fetchAppAchievements(game: SteamApp, lang = "english") {
    if (browser) throw new Error("Cannot fetch app achievements in a browser context.");
    const { locals } = getRequestEvent();
    const { steamClient } = locals;
    const schema = await steamClient.getSchemaForGame({ appid: game.id, l: lang });
    const achievementPercentages = await steamClient.getGlobalAchievementPercentagesForApp({
        gameid: game.id,
    });
    if (!schema || !achievementPercentages) {
        throw new Error("Failed to fetch schema or achievement percentages.");
    }
    const stats = schema.game.availableGameStats?.achievements;
    if (!stats) throw new Error("No achievements found in schema.");
    const achievements: SteamAppAchievement[] = [];
    for (const stat of stats) {
        const global = achievementPercentages.achievementpercentages.achievements.find(
            (achievement) => achievement.name === stat.name,
        );
        if (!global) throw new Error("No global achievement found.");
        achievements.push(new SteamAppAchievement(game, stat, global, lang));
    }
    return achievements;
}

export async function fetchSteamApp(app: number | SteamOwnedGame, lang = "english") {
    if (browser) throw new Error("Cannot fetch Steam app details in a browser context.");
    const { locals } = getRequestEvent();
    const { steamStoreClient } = locals;
    const appId = typeof app === "number" ? app : app.id;
    const data1 = await steamStoreClient.getAppDetails(appId, { l: lang });
    const data = data1[appId.toString()];
    if (!data.success) {
        throw new Error("Failed to fetch Steam app details.");
    }
    return new SteamApp(data.data, lang);
}

export async function fetchFriends(user: SteamUser) {
    if (!(user instanceof SteamUser)) throw new Error("getFriends must be called on an instance of SteamUser.");
    if (browser) throw new Error("Cannot get friends in a browser context.");

    const { locals } = getRequestEvent();

    const { steamClient } = locals;

    const { friendslist } = await steamClient.getFriendsList({
        relationship: "friend",
        steamid: user.id,
    });

    const friendsList = new Array<SteamUser>();
    for (const friend of friendslist.friends) {
        const friendData = await fetchUser(friend.steamid);
        if (!friendData) continue;
        friendsList.push(friendData);
    }

    return friendsList;
}

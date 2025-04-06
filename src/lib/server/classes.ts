import {
    getOwnedSteamGamesAPI,
    getSteamAppsAPI,
    getSteamFriendsAPI,
    getSteamGameAchievementsAPI,
    getSteamUserAchievementsAPI,
    getSteamUsersAPI,
} from "$lib/server/api/repositories";
import {
    getOwnedSteamGamesDB,
    getSteamAppsDB,
    getSteamFriendsDB,
    getSteamGameAchievementsDB,
    getSteamUserAchievementsDB,
    getSteamUsersDB,
    upsertGameAchievementsDB,
    upsertOwnedGames,
    upsertSteamAppsDB,
    upsertSteamFriendsDB,
    upsertSteamUserAchievementsDB,
    upsertSteamUsersDB,
} from "$lib/server/db/repositories";
import { fetchAndUpsert } from "$lib/server/fetchAndUpsert";
import { SteamApp } from "$lib/steam/data/SteamApp";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
import { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame";
import { SteamUser } from "$lib/steam/data/SteamUser";
import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";

export async function fetchSteamUserAchievements(
    games: Array<number | SteamApp | SteamOwnedGame>,
    user: Array<string | SteamUser>,
    lang = "english",
) {
    const gameIds = games.map((game) => (typeof game === "number" ? game : game.id));
    const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));

    const gameAchievements = await fetchAndUpsert(
        [gameIds, userIds, lang],
        getSteamUserAchievementsDB,
        upsertSteamUserAchievementsDB,
        getSteamUserAchievementsAPI,
    );

    // Because we can pass in ids instead of just SteamApp objects, we need to fetch the games again if we don't have them

    let newGames: SteamApp[];
    if (games[0] instanceof SteamApp) {
        newGames = games as SteamApp[];
    } else {
        const gameIds = games.map((game) => (typeof game === "number" ? game : game.id));
        const gameApps = await fetchSteamApps(gameIds);
        newGames = [...gameApps.values()];
    }

    const userAchievements = new Map<number, Map<string, Map<string, SteamUserAchievement>>>();
    for (const [gameId, game] of gameAchievements) {
        for (const [userId, user] of game) {
            for (const [achievementId, achievement] of user) {
                const { global, meta, userStats } = achievement;
                const gameData = newGames.find((game) => game.id === gameId);
                if (!gameData) continue;
                const userAchievement = new SteamUserAchievement(gameData, userId, meta, global, userStats, lang);
                const userAchievementList = userAchievements.get(gameId)?.get(userId);
                if (userAchievementList) {
                    userAchievementList.set(achievementId, userAchievement);
                } else {
                    const newUserAchievementList = new Map<string, SteamUserAchievement>();
                    newUserAchievementList.set(achievementId, userAchievement);
                    const userMap =
                        userAchievements.get(gameId) ?? new Map<string, Map<string, SteamUserAchievement>>();
                    userMap.set(userId, newUserAchievementList);
                    userAchievements.set(gameId, userMap);
                }
            }
        }
    }

    return userAchievements;
}

export async function fetchSteamUsers(steamId: string[]) {
    const players = await fetchAndUpsert([steamId], getSteamUsersDB, upsertSteamUsersDB, getSteamUsersAPI);

    const users = new Map<string, SteamUser>();
    for (const [_, player] of players) {
        const user = new SteamUser(player);
        users.set(user.id, user);
    }
    return users;
}

export async function fetchOwnedSteamGames(user: Array<string | SteamUser>) {
    const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));
    const games = await fetchAndUpsert([userIds], getOwnedSteamGamesDB, upsertOwnedGames, getOwnedSteamGamesAPI);
    const ownedGames = new Map<string, SteamOwnedGame[]>();
    for (const [userId, game] of games) {
        const userOwnedGames = new Array<SteamOwnedGame>();
        for (const ownedGame of game) {
            const steamOwnedGame = new SteamOwnedGame(ownedGame);
            userOwnedGames.push(steamOwnedGame);
        }
        ownedGames.set(userId, userOwnedGames);
    }
    return ownedGames;
}

export async function fetchSteamGameAchievements(game: SteamApp[], lang = "english") {
    const gameIds = game.map((game) => (game instanceof SteamOwnedGame ? game.id : game.id));
    const achievements = await fetchAndUpsert(
        [gameIds],
        getSteamGameAchievementsDB,
        upsertGameAchievementsDB,
        getSteamGameAchievementsAPI,
    );

    const gameAchievements = new Map<number, Map<string, SteamAppAchievement>>();
    for (const [gameId, achievement] of achievements) {
        const gameAchievementsMap = new Map<string, SteamAppAchievement>();

        const gameData = game.find((game) => game.id === gameId);
        if (!gameData) continue;

        for (const [achievementId, { global, meta }] of achievement) {
            const gameAchievement = new SteamAppAchievement(gameData, meta, global, lang);
            gameAchievementsMap.set(achievementId, gameAchievement);
        }
        if (gameData) gameAchievements.set(gameId, gameAchievementsMap);
    }
    return gameAchievements;
}

export async function fetchSteamApps(app: Array<number | SteamOwnedGame>) {
    const appIds = app.map((game) => (game instanceof SteamOwnedGame ? game.id : game));
    const apps = await fetchAndUpsert([appIds], getSteamAppsDB, upsertSteamAppsDB, getSteamAppsAPI);

    const steamApps = new Map<number, SteamApp>();
    for (const [, app] of apps) {
        const steamApp = new SteamApp(app);
        steamApps.set(steamApp.id, steamApp);
    }
    return steamApps;
}

export async function fetchSteamFriends(user: SteamUser[]) {
    const userIds = user.map((user) => (user instanceof SteamUser ? user.id : user));
    const userIdFriendIdMap = await fetchAndUpsert(
        [userIds],
        getSteamFriendsDB,
        upsertSteamFriendsDB,
        getSteamFriendsAPI,
    );

    const friendIds = [...userIdFriendIdMap.values()].flat().map((user) => user.steamid);
    const friendUsers = new Map(
        [...(await fetchAndUpsert([friendIds], getSteamUsersDB, upsertSteamUsersDB, getSteamUsersAPI)).entries()].map(
            ([_, user]) => {
                const steamUser = new SteamUser(user);
                return [steamUser.id, steamUser];
            },
        ),
    );

    // Match the users back into their original friends list
    const friendsList = new Map<string, SteamUser[]>();
    for (const [userId, friends] of userIdFriendIdMap) {
        const users = friends.map((f) => friendUsers.get(f.steamid)).filter((user) => !!user);

        friendsList.set(userId, users);
    }

    return friendsList;
}

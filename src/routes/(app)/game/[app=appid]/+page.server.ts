import { fetchAppAchievements, fetchFriends, fetchOwnedGames, fetchUserAchievements } from "$lib/server/classes.js";
import type { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame.js";
import type { SteamUser } from "$lib/steam/data/SteamUser";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";

export const load = async ({ parent, locals }) => {
    const { app } = await parent();

    const achievements = await fetchAppAchievements(app);

    let friends: {
        user: SteamUser;
        owned: SteamOwnedGame;
        achievements: SteamUserAchievement[];
    }[] = [];
    if (locals.steamUser) {
        const f = await fetchFriends(locals.steamUser);

        // @ts-ignore
        friends = await Promise.all(
            f
                .map(async (friend) => {
                    const ownedGames = await fetchOwnedGames(friend);
                    const owned = ownedGames.find((game) => game.id === app.id);
                    if (!owned) return null;
                    const achievements = await fetchUserAchievements(owned, friend.id);

                    return {
                        user: friend,
                        owned,
                        achievements,
                    };
                })
                .filter((friend) => friend !== null),
        ).then((friends) => friends.filter((friend) => friend !== null));
    }

    return {
        achievements,
        friends,
    };
};

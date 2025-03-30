import type { SteamApp } from "$lib/steam/data/SteamApp";
import type { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame.js";
import type { SteamUser } from "$lib/steam/data/SteamUser";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";

export const load = async ({ parent, locals }) => {
    const { app } = await parent();

    const achievements = await app.getAchievements();

    let friends: {
        user: SteamUser;
        owned: SteamOwnedGame;
        achievements: SteamUserAchievement[];
    }[] = [];
    if (locals.steamUser) {
        const f = await locals.steamUser.getFriends();

        // @ts-ignore
        friends = await Promise.all(
            f
                .map(async (friend) => {
                    const ownedGames = await friend.getOwnedGames();
                    const owned = ownedGames.find((game) => game.id === app.id);
                    if (!owned) return null;
                    const achievements = await friend.getAchievements(app.id);

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

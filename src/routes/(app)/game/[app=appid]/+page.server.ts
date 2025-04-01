import {
    fetchSteamGameAchievements,
    fetchSteamFriends,
    fetchOwnedSteamGames,
    fetchSteamUserAchievements,
    fetchSteamApps,
} from "$lib/server/classes.js";
import type { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame.js";
import type { SteamUser } from "$lib/steam/data/SteamUser";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";

export const load = async ({ parent, locals }) => {
    const { app } = await parent();

    const achievements = locals.steamUser
        ? await fetchSteamUserAchievements([app], [locals.steamUser])
        : await fetchSteamGameAchievements([app]);

    let friends: {
        user: SteamUser;
        owned: SteamOwnedGame;
        achievements: SteamUserAchievement[];
    }[] = [];
    if (locals.steamUser) {
        const f = (await fetchSteamFriends([locals.steamUser])).get(locals.steamUser.id);
        if (!f) return { achievements, friends };

        const owned = await fetchOwnedSteamGames(f);

        // ONLY FETCH THE CURRENT APP
        const friendAchievements = await fetchSteamUserAchievements([app], f, "english");

        // Map back into friends
        friends = f
            .map((friend) => {
                const ownedGames = owned.get(friend.id);
                const ownedGame = ownedGames?.find((game) => game.id === app.id);
                if (!ownedGame?.playtime || ownedGame.playtime === 0) return null;
                const achievements = friendAchievements.get(app.id)?.get(friend.id);
                if (!achievements) return null;
                const friendAchievementsList = [...achievements.values()].flat();
                if (!friendAchievementsList) return null;
                return {
                    user: friend,
                    owned: ownedGame,
                    achievements: friendAchievementsList,
                };
            })
            .filter((friend) => friend !== null)
            .sort((a, b) => (b?.owned.playtime ?? 0) - (a?.owned.playtime ?? 0));
    }

    return {
        achievements,
        friends,
    };
};

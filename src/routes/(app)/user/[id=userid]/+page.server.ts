import { SteamUser } from "$lib/steam/data/SteamUser.js";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const { id: steamId } = params;

    const user = await SteamUser.fetchUser(steamId);
    if (!user) error(404, "User not found");

    const achievements = await user
        .getOwnedGames()
        .then((games) => {
            return Promise.all(games.map((game) => game.getApp().catch(() => null)));
        })
        .then((games) => {
            return Promise.all(games.map((game) => game?.getUserAchievements(steamId)));
        })
        .then((achievements) => {
            return achievements
                .flat()
                .filter((achieve) => achieve?.unlocked)
                .map((achieve) => achieve as SteamUserAchievement)
                .sort((a, b) => (a.globalPercentage ?? 0) - (b.globalPercentage ?? 0))
                .slice(0, 24);
        });

    return {
        achievements,
    };
};

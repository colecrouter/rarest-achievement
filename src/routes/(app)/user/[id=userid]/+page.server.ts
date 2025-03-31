import { fetchOwnedGames, fetchSteamApp, fetchUser, fetchUserAchievements } from "$lib/server/classes";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const { id: steamId } = params;

    const user = await fetchUser(steamId);
    if (!user) error(404, "User not found");

    const achievements = await fetchOwnedGames(user)
        .then((games) => {
            return Promise.all(games.map((game) => fetchSteamApp(game).catch(() => null)));
        })
        .then((games) => {
            return Promise.all(games.map((game) => game && fetchUserAchievements(game, user).catch(() => null)));
        })
        .then((achievements) => {
            console.log(achievements.filter((a) => !a));
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

import { fetchOwnedSteamGames, fetchSteamApps, fetchSteamUserAchievements, fetchSteamUsers } from "$lib/server/classes";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const { id: steamId } = params;

    const [user] = [...(await fetchSteamUsers([steamId])).values()];
    if (!user) error(404, "User not found");

    // Fetch owned games
    const ownedGames = await fetchOwnedSteamGames([user]);

    // Fetch Steam apps concurrently; ignore failed fetches via try/catch
    const gameIds = [...ownedGames.values()].flat().map((game) => game.id);
    const gameApps = [...(await fetchSteamApps(gameIds)).values()];

    // Batch fetch achievements for all valid games and the user in one call
    const allAchievements = await fetchSteamUserAchievements(gameApps, [user], "english");

    // Flatten the achievements map to get a list of all achievements
    const allGames = [...allAchievements.values()];
    const allGamesForUser = allGames.map((m) => m.get(user.id));
    const allAchievementsForUser = allGamesForUser.flat().reduce((acc, curr) => {
        if (curr) {
            acc.push(...curr.values());
        }
        return acc;
    }, [] as SteamUserAchievement[]);

    // Process achievements: filter by unlocked, cast and sort, then slice
    const achievements = allAchievementsForUser
        .filter((achieve) => achieve?.unlocked)
        .map((achieve) => achieve as SteamUserAchievement)
        .sort((a, b) => (a.globalPercentage ?? 0) - (b.globalPercentage ?? 0))
        .slice(0, 24);

    return {
        achievements,
    };
};

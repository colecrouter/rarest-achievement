import { EnhancedSteamRepository } from "$lib/server/enhanced/repo.js";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";

export const load = async ({ params, parent }) => {
    const achievements = (async () => {
        const repo = new EnhancedSteamRepository();
        const { user: u } = await parent();

        // Fetch owned games
        const { data: ownedGameMap, error: err1 } = await repo.getOwnedGames([u]);
        const ownedGames = [...ownedGameMap.values()].flat();

        // Fetch Steam apps concurrently; ignore failed fetches via try/catch
        const gameIds = [...new Set(ownedGames.map((game) => game.id))];

        const { data: gameMap, error: err2 } = await repo.getApps(gameIds);
        const gameApps = [...gameMap.values()];

        // Batch fetch achievements for all valid games and the user in one call
        const { data: allAchievements, error: err3 } = await repo.getUserAchievements(gameApps, [u], "english");

        // Log all game ids, where an achievement is present
        const gameIdsWithAchievements = [...allAchievements.keys()];
        const gameIdsWithAchievementsSet = new Set(gameIdsWithAchievements);
        const gameIdsWithAchievementsFiltered = gameIds.filter((id) => gameIdsWithAchievementsSet.has(id));
        console.log("Game IDs with achievements:", gameIdsWithAchievementsFiltered.slice(-20));

        // Flatten the achievements map to get a list of all achievements
        const allGames = [...allAchievements.values()];
        const allGamesForUser = allGames.map((m) => m.get(u.id)).filter((g) => !!g);
        const allAchievementsForUser = [...allGamesForUser.map((m) => [...m.values()])].flat();

        // Process achievements: filter by unlocked, cast and sort, then slice
        const achievements = allAchievementsForUser
            .filter((achieve) => achieve?.unlocked)
            .map((achieve) => achieve as SteamUserAchievement)
            .sort((a, b) => (a.globalPercentage ?? 0) - (b.globalPercentage ?? 0))
            .slice(0, 24);

        return {
            achievements,
            didErr: Boolean(err1 || err2 || err3),
        };
    })();

    return {
        achievements,
    };
};

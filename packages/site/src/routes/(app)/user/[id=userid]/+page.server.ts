import { EnhancedSteamRepository, type SteamUserAchievement } from "lib";

export const load = async ({ url, parent, locals }) => {
    const sortMethod = (
        url.searchParams.get("sort") === "count" ? "globalCount" : "globalPercentage"
    ) satisfies keyof SteamUserAchievement;

    const achievements = (async () => {
        const repo = new EnhancedSteamRepository(locals);
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

        // Flatten the achievements map to get a list of all achievements
        const allGames = [...allAchievements.values()];
        const allGamesForUser = allGames.map((m) => m.get(u.id)).filter((g) => !!g);
        const allAchievementsForUser = [...allGamesForUser.map((m) => [...m.values()])].flat();

        // Process achievements: filter by unlocked, cast and sort, then slice
        const achievements = allAchievementsForUser
            .filter((achieve) => achieve?.unlocked)
            .sort((a, b) => a[sortMethod] - b[sortMethod])
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

import { EnhancedSteamRepository, userScores } from "@project/lib";

export const load = async ({ parent, locals }) => {
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

        // Flatten the achievements map to get a list of all achievements
        const allGames = [...allAchievements.values()];
        const allGamesForUser = allGames.map((m) => m.get(u.id)).filter((g) => !!g);
        const allAchievementsForUser = [...allGamesForUser.map((m) => [...m.values()])].flat();

        // Process achievements: filter by unlocked, cast and sort, then slice
        const achievementsByPercent = allAchievementsForUser
            .filter((achieve) => achieve?.unlocked)
            .sort((a, b) => a.globalPercentage - b.globalPercentage)
            .slice(0, 36);

        const achievementsByCount = allAchievementsForUser
            .filter((achieve) => achieve?.unlocked)
            .sort((a, b) => a.globalCount - b.globalCount)
            .slice(0, 36);

        // Update user score
        const score = allAchievementsForUser.filter(
            (achieve) => achieve?.unlocked && achieve?.globalPercentage < 10,
        ).length;
        await locals.steamCacheDB
            .insert(userScores)
            .values({
                user_id: u.id,
                rare_count: score,
            })
            .onConflictDoUpdate({
                target: [userScores.user_id],
                set: {
                    rare_count: score,
                    updated_at: new Date(),
                },
            });

        return {
            achievements: {
                globalPercentage: achievementsByPercent,
                globalCount: achievementsByCount,
            },
            rareCount: score,
            didErr: Boolean(err1 || err2 || err3),
        };
    })();

    return {
        achievements,
    };
};

import { EnhancedSteamRepository, userScores } from "@project/lib";

export const load = async ({ parent, locals }) => {
    const achievements = (async () => {
        const repo = new EnhancedSteamRepository(locals);
        const { user: u } = await parent();

        // Fetch owned games
        console.time("Fetching owned games");
        const { data: ownedGameMap, error: err1 } = await repo.getOwnedGames([u]);
        const ownedGames = [...ownedGameMap.values()].flat();
        console.timeEnd("Fetching owned games");

        // Fetch Steam apps concurrently; ignore failed fetches via try/catch
        const gameIds = [...new Set(ownedGames.map((game) => game.id))];

        console.time("Fetching game apps");
        const { data: gameMap, error: err2 } = await repo.getApps(gameIds);
        const gameApps = [...gameMap.values()];
        console.timeEnd("Fetching game apps");

        // Batch fetch achievements for all valid games and the user in one call
        console.time("Fetching achievements");
        const { data: allAchievements, error: err3 } = await repo.getUserAchievements(gameApps, [u], "english");
        console.timeEnd("Fetching achievements");

        // Flatten the achievements map to get a list of all achievements
        const allGames = [...allAchievements.values()];
        const allGamesForUser = allGames.map((m) => m.get(u.id)).filter((g) => !!g);
        const allAchievementsForUser = [...allGamesForUser.map((m) => [...m.values()])]
            .flat()
            .filter((a) => a.unlocked);

        // Update user score
        const score = allAchievementsForUser.filter((achieve) => achieve?.unlocked).length;

        console.time("Updating user score");
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
        console.timeEnd("Updating user score");

        console.log("Achievements for user:", allAchievementsForUser.length);

        const err = err1 || err2 || err3;
        if (err) console.error("Error fetching data:", err);

        return {
            achievements: allAchievementsForUser,
            rareCount: score,
            didErr: Boolean(err),
        };
    })();

    return {
        achievements,
    };
};

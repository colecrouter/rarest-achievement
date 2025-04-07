import { EnhancedSteamRepository } from "$lib/server/enhanced/repo.js";
import type { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement.js";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const { id: steamId } = params;

    const repo = new EnhancedSteamRepository();

    const user = (async () => {
        // TODO error handling?
        const { data } = await repo.getUsers([steamId]);
        const user = data.get(steamId);
        if (!user) error(404, "User not found");

        return user;
    })();

    const achievements = (async () => {
        const u = await user;

        // Fetch owned games
        const { data: ownedGameMap, error: err1 } = await repo.getOwnedGames([u]);
        const ownedGames = [...ownedGameMap.values()].flat();
        // console.log(
        //     "Katana Zero (Owned)",
        //     ownedGames.find((g) => g.id === 460950),
        // );

        // Fetch Steam apps concurrently; ignore failed fetches via try/catch
        const gameIds = [...new Set(ownedGames.map((game) => game.id))];
        // console.log(
        //     "Katana Zero (Game IDs)",
        //     gameIds.find((g) => g === 460950),
        // );
        // const gameApps = [...(await fetchSteamApps(gameIds.filter((g) => g === 460950))).values()];
        // const gameApps = [...(await fetchSteamApps(gameIds)).values()];
        const { data: gameMap, error: err2 } = await repo.getApps(gameIds);
        const gameApps = [...gameMap.values()];
        // console.log(
        //     "Katana Zero (App)",
        //     gameApps.find((g) => g.id === 460950),
        // );

        // Batch fetch achievements for all valid games and the user in one call
        const { data: allAchievements, error: err3 } = await repo.getUserAchievements(gameApps, [u], "english");
        // console.log("Katana Zero (Achievements)", allAchievements.get(460950)?.get(u.id));

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
        user: await user,
        achievements,
    };
};

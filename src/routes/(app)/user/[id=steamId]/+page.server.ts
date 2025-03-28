import { error } from "@sveltejs/kit";

export const load = async ({ locals, params }) => {
    const { steamClient, steamStoreClient } = locals;
    const { id: steamId } = params;

    const users = await steamClient.getPlayerSummaries([steamId]);

    const achievementPercentages = await steamClient.getGlobalAchievementPercentagesForApp({
        gameid: 440,
    });

    const userAchievements = await steamClient.getPlayerAchievements({
        steamid: steamId,
        appid: 440,
        l: "english",
    });

    // error(503, "Failed to fetch user achievements");

    const data = await steamStoreClient.getAppDetails(440, { filters: ["achievements"] });
    data[440].data.achievements;

    const schema = await steamClient.getSchemaForGame(440);

    const joined = userAchievements?.playerstats.achievements
        .filter((achievement) => achievement.unlocktime)
        .map((achievement) => {
            const percentage = achievementPercentages?.achievementpercentages.achievements.find(
                (percentage) => percentage.name === achievement.apiname,
            );
            const achievementData = schema?.game.availableGameStats?.achievements?.find(
                (schemaAchievement) => schemaAchievement.name === achievement.apiname,
            );

            return {
                name: achievement.name ?? achievement.apiname,
                description: achievementData?.description ?? "",
                rarity: percentage?.percent ?? 0,
                icon: achievementData?.icon ?? "", // TODO
                game: {
                    appid: 440,
                    name: schema?.game.gameName ?? "",
                },
                unlocked: new Date(achievement.unlocktime * 1000),
            };
        });

    // Sort & limit by rarity (top 24)
    const achievements = joined?.sort((a, b) => (a.rarity ?? 0) - (b.rarity ?? 0)).slice(0, 24) ?? [];

    return {
        user: users.response.players[0],
        achievements,
    };
};

export const load = async ({ locals, params }) => {
    const { steamAuthenticated, steamStore } = locals;
    const { id: steamId } = params;

    console.log(steamId);

    const users = await steamAuthenticated.getPlayerSummaries([steamId]);

    const achievementPercentages = await steamAuthenticated.getGlobalAchievementPercentagesForApp({
        gameid: 440,
    });

    const userAchievements = await steamAuthenticated.getPlayerAchievements({
        steamid: steamId,
        appid: 440,
        l: "english",
    });

    const schema = await steamAuthenticated.getSchemaForGame(440);

    const joined = userAchievements?.playerstats.achievements.map((achievement) => {
        const percentage = achievementPercentages?.achievementpercentages.achievements.find(
            (percentage) => percentage.name === achievement.apiname,
        );
        const achievementData = schema?.game.availableGameStats?.achievements?.find(
            (schemaAchievement) => schemaAchievement.name === achievement.apiname,
        );

        return {
            name: achievement.description ?? achievement.apiname,
            percent: percentage?.percent,
            icon: achievementData?.icon,
        };
    });

    return {
        user: users.response.players[0],
        joined,
    };
};

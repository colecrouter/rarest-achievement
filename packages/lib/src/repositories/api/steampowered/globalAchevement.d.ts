export type GetGlobalAchievementPercentagesForAppQuery = {
    gameid: number; // AppID
};

export type GetGlobalAchievementPercentagesForAppResponse = {
    achievementpercentages: {
        achievements: Array<{
            name: string; // Achievement name
            percent: number; // Percentage of players who have unlocked the achievement
        }>;
    };
};

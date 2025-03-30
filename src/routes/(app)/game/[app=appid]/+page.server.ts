export const load = async ({ parent }) => {
    const { app } = await parent();

    const achievements = await app.getAchievements();

    return {
        achievements,
    };
};

import { fetchAppAchievements } from "$lib/server/classes";
import { error } from "@sveltejs/kit";

export const load = async ({ params, parent }) => {
    const achievementId = params.achievement;

    const { app } = await parent();

    const achievements = await fetchAppAchievements(app, "english");
    const achievement = achievements.find((achieve) => achieve.id === achievementId);
    if (!achievement) error(404, "Game not found");

    return {
        achievement,
    };
};

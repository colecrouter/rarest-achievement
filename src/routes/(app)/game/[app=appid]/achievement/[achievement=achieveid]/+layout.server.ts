import { error } from "@sveltejs/kit";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";

export const load = async ({ params, parent }) => {
    const achievementId = params.achievement;

    const { app } = await parent();

    const achievements = await SteamAppAchievement.fetchAppAchievements(app, "english");
    const achievement = achievements.find((achieve) => achieve.internalName === achievementId);
    if (!achievement) error(404, "Game not found");

    return {
        achievement,
    };
};

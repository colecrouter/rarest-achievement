import { fetchSteamGameAchievements } from "$lib/server/classes";
import { error } from "@sveltejs/kit";

export const load = async ({ params, parent }) => {
    const achievementId = params.achievement;

    const { app } = await parent();

    const achievements = await fetchSteamGameAchievements([app]);
    const achievement = achievements.get(app.id)?.get(achievementId);
    if (!achievement) error(404, "Game not found");

    return {
        achievement,
    };
};

import type { Breadcrumb } from "$lib/breadcrumbs/breadcrumbs";
import { EnhancedSteamRepository } from "$lib/server/enhanced/repo";
import { error } from "@sveltejs/kit";

export const load = async ({ params, parent }) => {
    const achievementId = params.achievement;

    const repo = new EnhancedSteamRepository();

    const { app, breadcrumbs: parentBreadcrumbs } = await parent();

    const { data: achievements } = await repo.getGameAchievements([app]);
    const achievement = achievements.get(app.id)?.get(achievementId);
    if (!achievement) error(404, "Game not found");

    const breadcrumbs = [
        ...parentBreadcrumbs,
        {
            label: achievement.name,
            href: `/game/${app.id}/achievement/${achievementId}`,
        },
    ] satisfies Breadcrumb[];

    return {
        achievement,
        breadcrumbs,
    };
};

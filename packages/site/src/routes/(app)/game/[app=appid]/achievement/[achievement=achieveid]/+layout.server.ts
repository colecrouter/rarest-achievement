import type { Breadcrumb } from "$lib/breadcrumbs";
import { error } from "@sveltejs/kit";
import { EnhancedSteamRepository } from "@project/lib";

export const load = async ({ params, parent, locals }) => {
    const achievementId = params.achievement;

    const repo = new EnhancedSteamRepository(locals);

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

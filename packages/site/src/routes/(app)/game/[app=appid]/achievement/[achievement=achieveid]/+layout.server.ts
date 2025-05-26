import type { Breadcrumb } from "$lib/breadcrumbs";
import { EnhancedSteamRepository } from "@project/lib";
import { error } from "@sveltejs/kit";
import { getLocale } from "$lib/paraglide/runtime.js";

export const load = async ({ params, parent, locals }) => {
    const achievementId = decodeURIComponent(params.achievement);

    const repo = new EnhancedSteamRepository(locals);

    const { app, breadcrumbs: parentBreadcrumbs } = await parent();

    const { data: achievements } = await repo.getGameAchievements([app], getLocale());
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

import type { Breadcrumb } from "$lib/breadcrumbs";
import { getLocale } from "$lib/paraglide/runtime.js";
import { EnhancedSteamRepository, TranslateRepository, type SteamAppAchievement } from "@project/lib";
import { error } from "@sveltejs/kit";

export const load = async ({ params, parent, locals }) => {
    const achievementId = decodeURIComponent(params.achievement);

    const repo = new EnhancedSteamRepository(locals);
    const translate = new TranslateRepository(locals.translateClient, locals.miscCache);

    const { app, breadcrumbs: parentBreadcrumbs } = await parent();

    const { data: achievements } = await repo.getGameAchievements([app], getLocale());
    const achievement = achievements.get(app.id)?.get(achievementId);
    if (!achievement) error(404, "Game not found");

    const translation =
        getLocale() !== achievement.language
            ? ((await translate.translateAchievements([achievement], getLocale())).values().take(1).toArray()[0] ??
              null)
            : null;

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
        translation,
    };
};

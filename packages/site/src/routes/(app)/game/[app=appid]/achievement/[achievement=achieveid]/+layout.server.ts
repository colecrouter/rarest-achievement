import { TranslateRepository } from "@project/lib";
import { error } from "@sveltejs/kit";
import type { Breadcrumb } from "$lib/breadcrumbs";
import { getLocale } from "$lib/paraglide/runtime.js";

export const load = async ({ params, parent, locals }) => {
	const achievementId = decodeURIComponent(params.achievement);

	const translate = new TranslateRepository(locals.translateClient, locals.miscCache);

	const { app, breadcrumbs: parentBreadcrumbs } = await parent();

	const { data: achievements } = await locals.vault.appAchievements
		.compose()
		.withLanguage(getLocale())
		.withAppIds([app.id])
		.build();
	const achievement = achievements?.find((a) => a.id === achievementId);
	if (!achievement) error(404, "Achievement not found");

	const translation =
		getLocale() !== achievement.language
			? ((await translate.translateAchievements([achievement], getLocale())).get(achievement) ?? null)
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

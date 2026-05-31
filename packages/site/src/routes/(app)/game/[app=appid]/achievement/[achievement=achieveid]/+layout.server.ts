import { TranslateClient, TranslateRepository } from "@project/lib";
import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { Breadcrumb } from "$lib/breadcrumbs";
import { getLocale } from "$lib/paraglide/runtime.js";

export const load = async ({ params, parent, locals, platform }) => {
	const achievementId = decodeURIComponent(params.achievement);

	const cache = platform?.env.STEAM_CACHE;
	if (!cache) throw new Error("STEAM_CACHE is not available in this environment");
	const translate = new TranslateRepository(new TranslateClient(env.GOOGLE_API_KEY), cache);

	const { app, breadcrumbs: parentBreadcrumbs } = await parent();

	const gameAchievements = await locals.vault.appAchievements
		.compose()
		.withLanguage(getLocale())
		.withAppIds([app.id])
		.build();

	const achievement = gameAchievements.data.find((a) => a.id === achievementId);
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
		gameAchievements,
		achievement,
		breadcrumbs,
		translation,
	};
};

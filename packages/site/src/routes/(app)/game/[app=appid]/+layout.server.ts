import { error } from "@sveltejs/kit";
import type { Breadcrumb } from "$lib/breadcrumbs";
import { getLocale } from "$lib/paraglide/runtime.js";

export const load = async ({ params, locals }) => {
	const appId = Number.parseInt(params.app, 10);

	// Convert locale to API language code
	const locale = getLocale();

	// Use composable query instead of direct repository call
	const results = await locals.vault.apps.compose().withLanguage(locale).withAppIds(appId).build({ limit: 1 });

	const app = results.data.find((item) => item.id === appId);
	if (!app) error(404, "Game not found");

	const breadcrumbs = [
		{
			label: app.name,
			href: `/game/${appId}`,
		},
	] satisfies Breadcrumb[];

	return {
		app,
		breadcrumbs,
	};
};

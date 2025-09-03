import type { Breadcrumb } from "$lib/breadcrumbs.js";
import { error } from "@sveltejs/kit";
import { getLocale } from "../../../../lib/paraglide/runtime.js";

export const load = async ({ params, locals }) => {
	const { id } = params;

	const locale = getLocale();

	const { data } = await locals.vault.users
		.compose()
		.withUserIds([id])
		.build({ limit: 1, sort: { method: "id", direction: "asc" } });
	const user = data.find((u) => u.id === id);
	if (!user) error(404, "User not found");

	const topThree = locals.vault.userAchievements
		.compose()
		.withLanguage(locale)
		.withUserIds([user.id])
		.withUnlockedStatus(true)
		.build({ limit: 3, sort: { method: "rarity_pct", direction: "asc" } });

	const breadcrumbs = [
		{
			label: user.displayName,
			href: `/user/${user.id}`,
		},
	] satisfies Breadcrumb[];

	return {
		breadcrumbs,
		topThree,
		user,
	};
};

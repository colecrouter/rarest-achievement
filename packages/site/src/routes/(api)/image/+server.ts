import { error } from "@sveltejs/kit";
import { dev } from "$app/environment";

export const GET = async ({ url }) => {
	if (!dev) return error(404, "Not found");

	const img = url.searchParams.get("url");

	return fetch(img ?? "");
};

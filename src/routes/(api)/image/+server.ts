import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

export const GET = async ({ url }) => {
    if (!dev) return error(404, "Not found");

    const img = url.searchParams.get("url");

    return fetch(img ?? "");
};

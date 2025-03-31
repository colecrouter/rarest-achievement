import { fetchSteamApp } from "$lib/server/classes";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const appId = params.app;

    const app = await fetchSteamApp(Number.parseInt(appId), "english");
    if (!app) error(404, "Game not found");

    return {
        app,
    };
};

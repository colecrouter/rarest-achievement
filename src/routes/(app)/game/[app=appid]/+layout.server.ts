import { SteamApp } from "$lib/steam/data/SteamApp";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const appId = params.app;

    const app = await SteamApp.fetchSteamApp(Number.parseInt(appId), "english");
    if (!app) error(404, "Game not found");

    return {
        app,
    };
};

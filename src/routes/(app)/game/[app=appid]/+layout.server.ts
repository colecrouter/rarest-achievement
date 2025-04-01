import { fetchSteamApps } from "$lib/server/classes";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const appId = Number.parseInt(params.app);
    const apps = await fetchSteamApps([appId]);

    const app = apps.get(appId);
    if (!app) error(404, "Game not found");

    return {
        app,
    };
};

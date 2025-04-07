import { EnhancedSteamRepository } from "$lib/server/enhanced/repo";
import { error } from "@sveltejs/kit";

export const load = async ({ params }) => {
    const repo = new EnhancedSteamRepository();

    const appId = Number.parseInt(params.app);
    const results = await repo.getApps([appId]);

    const app = results.data.get(appId);
    if (!app) error(404, "Game not found");

    return {
        app,
    };
};

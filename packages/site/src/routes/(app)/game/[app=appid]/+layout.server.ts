import type { Breadcrumb } from "$lib/breadcrumbs";
import { EnhancedSteamRepository } from "@project/lib";
import { error } from "@sveltejs/kit";

export const load = async ({ params, locals }) => {
    const repo = new EnhancedSteamRepository(locals);

    const appId = Number.parseInt(params.app);
    const results = await repo.getApps([appId]);

    const app = results.data.get(appId);
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

import { SteamStoreAPIClient } from "@project/lib";

export const GET = async ({ url }) => {
    const param = url.searchParams.get("q") ?? "";
    const apps = await SteamStoreAPIClient.searchApps(param);
    return Response.json({
        apps: apps.slice(0, 5),
        total: apps.length,
    });
};

export type AppsResponse = {
    apps: Awaited<ReturnType<typeof SteamStoreAPIClient.searchApps>>;
    total: number;
} & {};

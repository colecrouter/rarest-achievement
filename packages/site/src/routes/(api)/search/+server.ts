import { SteamStoreAPIClient } from "@project/lib";

export const GET = async ({ url }) => {
    const param = url.searchParams.get("q") ?? "";
    const res = await SteamStoreAPIClient.searchApps(param);

    return Response.json(res);
};

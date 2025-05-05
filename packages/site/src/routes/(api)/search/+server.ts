import { SteamStoreAPIClient, SteamCommunityClient } from "@project/lib";

export const GET = async ({ url }) => {
    const param = url.searchParams.get("q") ?? "";
    const [apps, users] = await Promise.all([
        SteamStoreAPIClient.searchApps(param),
        SteamCommunityClient.searchUsers(param),
    ]);

    return Response.json({
        apps: {
            apps: apps.slice(0, 5),
            total: apps.length,
        },
        users: {
            users: users.users.slice(0, 5),
            total: users.total,
        },
    } satisfies _Response);
};

export type _Response = {
    apps: {
        apps: Awaited<ReturnType<typeof SteamStoreAPIClient.searchApps>>;
        total: number;
    };
    users: Awaited<ReturnType<typeof SteamCommunityClient.searchUsers>>;
};

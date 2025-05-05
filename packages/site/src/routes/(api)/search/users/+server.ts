import { SteamCommunityClient } from "@project/lib";

export const GET = async ({ url }) => {
    const param = url.searchParams.get("q") ?? "";
    const usersRes = await SteamCommunityClient.searchUsers(param);
    return Response.json({
        users: usersRes.users.slice(0, 5),
        total: usersRes.total,
    });
};

export type UsersResponse = Awaited<ReturnType<typeof SteamCommunityClient.searchUsers>>;

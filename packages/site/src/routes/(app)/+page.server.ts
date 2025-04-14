import { fail, redirect } from "@sveltejs/kit";
import { EnhancedSteamRepository, type SteamID, resolveSteamID } from "lib";

export const actions = {
    search: async ({ request }) => {
        const formData = await request.formData();
        const query = formData.get("q")?.toString();
        if (!query) return fail(400, { msg: "No query" });

        let id: SteamID;
        try {
            id = await resolveSteamID(query);
        } catch (e) {
            // TODO
            console.error(e);
            return fail(400, { msg: (e as Error).message });
        }

        return redirect(302, `/user/${id.toSteamID(1)}`);
    },
    login: async ({ url }) => {
        const baseUrl = new URL("https://steamcommunity.com/openid/login");

        const redirectUrl = new URL("/auth/steam/callback", url.origin);

        // These parameters follow the OpenID 2.0 spec for Steam.
        const params = new URLSearchParams({
            "openid.ns": "http://specs.openid.net/auth/2.0",
            "openid.mode": "checkid_setup",
            // This should point to your callback endpoint.
            "openid.return_to": redirectUrl.toString(),
            // This is your realm, typically your home page domain.
            "openid.realm": url.origin,
            // Using identifier select allows Steam to pick up the user’s Steam ID.
            "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
            "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        });

        // Redirect the user to Steam's OpenID endpoint with the parameters.
        // This will initiate the OpenID authentication process.
        baseUrl.search = params.toString();
        redirect(302, baseUrl);
    },
    logout: async ({ cookies }) => {
        // Clear the Steam ID cookie to log out the user.
        cookies.delete("steamid", { path: "/" });
        // Optionally, redirect the user to a different page after logging out.
        return redirect(302, "/");
    },
};

export const load = async ({ locals }) => {
    const showcase2IDs = [
        { game: 252950, achievement: "Spectacular" },
        { game: 105600, achievement: "PURIFY_ENTIRE_WORLD" },
        { game: 1085660, achievement: "ACH_23" },
    ];

    const repo = new EnhancedSteamRepository(locals);

    const { data: showcase2Apps } = await repo.getApps(showcase2IDs.map((m) => m.game));
    const { data: showcase2Achievements } = await repo.getGameAchievements([...showcase2Apps.values()]);
    const showcase2 = showcase2IDs
        .map(({ game, achievement }) => showcase2Achievements.get(game)?.get(achievement))
        .filter((m) => !!m);
    console.log(showcase2Apps);
    if (showcase2.length !== 3) throw new Error("Missing achievements");

    return {
        showcase2,
    };
};

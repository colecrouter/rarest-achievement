import { type SteamID, resolveSteamID } from "$lib/steam/search/id.js";
import { fail, redirect } from "@sveltejs/kit";

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
            return fail(400, { msg: (e as Error).message });
        }

        return redirect(302, `/user/${id.toSteamID(1)}`);
    },
    login: async ({ url }) => {
        const baseUrl = new URL("https://steamcommunity.com/openid/login");

        const redirectUrl = new URL(url, "/auth/steam/callback");

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
};

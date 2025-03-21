import { resolveSteamID, type SteamID } from "$lib/steam/search/id.js";
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
};

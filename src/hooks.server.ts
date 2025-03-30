import { STEAM_API_KEY } from "$env/static/private";
import { i18n } from "$lib/i18n";
import { SteamAuthenticatedAPIClient } from "$lib/server/api/steampowered/client";
import { SteamStoreAPIClient } from "$lib/server/api/store/client";
import { SteamUser } from "$lib/steam/data/SteamUser";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

const handleParaglide: Handle = i18n.handle();

const hook: Handle = async ({ event, resolve }) => {
    event.locals.steamClient = new SteamAuthenticatedAPIClient(STEAM_API_KEY);
    event.locals.steamStoreClient = new SteamStoreAPIClient();

    // Get details for the logged-in user
    event.locals.steamUser = null; // Default to null if no steamId is found
    const steamId = event.cookies.get("steamid");
    if (steamId) {
        try {
            event.locals.steamUser = await SteamUser.fetchUser(steamId);
        } catch (error) {
            console.error("Error fetching user:", error);

            // Remove the cookie if the user is not found
            event.cookies.delete("steamid", { path: "/" });
        }
    }

    return resolve(event);
};

export const handle = sequence(handleParaglide, hook);

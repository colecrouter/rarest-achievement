import { STEAM_API_KEY } from "$env/static/private";
import { i18n } from "$lib/i18n";
import { SteamAuthenticatedAPIClient } from "$lib/server/api/steampowered/client";
import { SteamStoreAPIClient } from "$lib/server/api/store/client";
import { fetchSteamUsers } from "$lib/server/classes";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { drizzle } from "drizzle-orm/d1";

const handleParaglide: Handle = i18n.handle();

const hook: Handle = async ({ event, resolve }) => {
    event.locals.steamClient = new SteamAuthenticatedAPIClient(STEAM_API_KEY);
    event.locals.steamStoreClient = new SteamStoreAPIClient();

    // Set up the Steam cache database
    if (!event.platform) throw new Error("Platform not found");
    event.locals.steamCacheDB = drizzle(event.platform.env.DB);

    // Get details for the logged-in user
    event.locals.steamUser = null; // Default to null if no steamId is found
    const steamId = event.cookies.get("steamid");
    if (steamId) {
        const users = await fetchSteamUsers([steamId]);
        const user = users.get(steamId);
        if (!user) {
            // Remove the cookie if the user is not found
            event.cookies.delete("steamid", { path: "/" });
        } else {
            event.locals.steamUser = user;
        }
    }

    return resolve(event);
};

export const handle = sequence(handleParaglide, hook);

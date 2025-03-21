import { STEAM_API_KEY } from "$env/static/private";
import { i18n } from "$lib/i18n";
import { SteamAuthenticatedAPIClient } from "$lib/steam/api/steampowered/auth/client";
import { SteamStoreAPIClient } from "$lib/steam/api/store/client";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { SteamClient } from "@tl3n/steam-api-wrapper";

const handleParaglide: Handle = i18n.handle();

const hook: Handle = async ({ event, resolve }) => {
    event.locals.steamAuthenticated = new SteamAuthenticatedAPIClient(STEAM_API_KEY);
    event.locals.steamStore = new SteamStoreAPIClient();

    return resolve(event);
};

export const handle = sequence(handleParaglide, hook);

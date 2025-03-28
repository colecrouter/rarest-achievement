import { STEAM_API_KEY } from "$env/static/private";
import { i18n } from "$lib/i18n";
import { SteamAuthenticatedAPIClient } from "$lib/server/api/steampowered/client";
import { SteamStoreAPIClient } from "$lib/server/api/store/client";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

const handleParaglide: Handle = i18n.handle();

const hook: Handle = async ({ event, resolve }) => {
    event.locals.steamClient = new SteamAuthenticatedAPIClient(STEAM_API_KEY);
    event.locals.steamStoreClient = new SteamStoreAPIClient();

    return resolve(event);
};

export const handle = sequence(handleParaglide, hook);

import { dev } from "$app/environment";
import { STEAM_API_KEY } from "$env/static/private";
import { paraglideMiddleware } from "$lib/paraglide/server";
import {
    EnhancedSteamRepository,
    SteamAuthenticatedAPIClient,
    SteamStoreAPIClient,
    setBypassCdnEnabled,
} from "@project/lib";
import { handleErrorWithSentry, initCloudflareSentryHandle, sentryHandle } from "@sentry/sveltekit";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { drizzle } from "drizzle-orm/d1";

// creating a handle to use the paraglide middleware
const paraglideHandle: Handle = ({ event, resolve }) =>
    paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
        event.request = localizedRequest;
        return resolve(event, {
            transformPageChunk: ({ html }) => {
                return html.replace("%lang%", locale);
            },
        });
    });

const authHandle: Handle = async ({ event, resolve }) => {
    event.locals.steamClient = new SteamAuthenticatedAPIClient(STEAM_API_KEY);
    event.locals.steamStoreClient = new SteamStoreAPIClient();

    // Set up the Steam cache database
    if (!event.platform) throw new Error("Platform not found");
    event.locals.steamCacheDB = drizzle(event.platform.env.DB);

    const repo = new EnhancedSteamRepository(event.locals);

    // Get details for the logged-in user
    event.locals.steamUser = null; // Default to null if no steamId is found
    const steamId = event.cookies.get("steamid");
    if (steamId) {
        const { data: users } = await repo.getUsers([steamId]);
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

const initSentryHandle = initCloudflareSentryHandle({
    dsn: "https://1090e526411b74ec7e519ecf548c54b5@o4508581503172608.ingest.us.sentry.io/4509233074667520",
    tracesSampleRate: 1,
});

export const handle = sequence(initSentryHandle, sentryHandle(), paraglideHandle, authHandle);

export const init = () => {
    dev && setBypassCdnEnabled(true);
};

export const handleError = handleErrorWithSentry();

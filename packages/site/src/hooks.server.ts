import { dev } from "$app/environment";
import { GOOGLE_API_KEY, STEAM_API_KEY } from "$env/static/private";
import { paraglideMiddleware } from "$lib/paraglide/server";
import {
    FetchManager,
    SteamAuthenticatedAPIClient,
    SteamStoreAPIClient,
    TranslateClient,
    VaultService,
    getFetchManager,
    setBypassCdnEnabled,
    setFetchManager,
} from "@project/lib";
import { handleErrorWithSentry, initCloudflareSentryHandle, sentryHandle } from "@sentry/sveltekit";
import type { Handle, HandleFetch } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { drizzle } from "drizzle-orm/d1";
import { Limiter } from "./lib/limiter";

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
    // Initialize fetch manager for this request
    const fetchManager = new FetchManager();
    setFetchManager(fetchManager);

    event.locals.steamClient = new SteamAuthenticatedAPIClient(STEAM_API_KEY);
    event.locals.steamStoreClient = new SteamStoreAPIClient();

    // Set up the Steam cache database
    if (!event.platform) throw new Error("Platform not found");
    event.locals.steamCacheDB = drizzle(event.platform.env.DB);

    event.locals.vault = new VaultService(event.locals.steamCacheDB, event.locals.steamClient);

    // Get details for the logged-in user
    event.locals.steamUser = null; // Default to null if no steamId is found
    const steamId = event.cookies.get("steamid");
    if (steamId) {
        const usersResult = await event.locals.vault.users.compose().withUserIds([steamId]).build({ limit: 1 });

        const user = usersResult.data?.find((u) => u.id === steamId);
        if (!user) {
            // Remove the cookie if the user is not found
            event.cookies.delete("steamid", { path: "/" });
        } else {
            event.locals.steamUser = user;
        }
    }

    // Initialize the TranslateClient
    event.locals.translateClient = new TranslateClient(GOOGLE_API_KEY);
    event.locals.miscCache = event.platform.env.STEAM_CACHE;

    return resolve(event);
};

const initSentryHandle = initCloudflareSentryHandle({
    dsn: "https://1090e526411b74ec7e519ecf548c54b5@o4508581503172608.ingest.us.sentry.io/4509233074667520",
    tracesSampleRate: 1,
});

// Define a no-op handle
const noopHandle: Handle = async ({ event, resolve }) => resolve(event);

// Use Sentry handlers only in production
export const handle = sequence(
    dev ? noopHandle : initSentryHandle,
    dev ? noopHandle : sentryHandle(),
    paraglideHandle,
    authHandle,
);

export const init = () => {
    dev && setBypassCdnEnabled(true);
};

export const handleError = handleErrorWithSentry();

// 10 concurrent fetches in dev mode
// Needed because Miniflare gets overloaded with too many fetches
const fetchDevLimiter = new Limiter(5);

/**
 * Intercept all fetch requests to automatically inject abort signals and count fetches
 */
export const handleFetch: HandleFetch = async ({ request, fetch }) => {
    const manager = getFetchManager();

    if (dev) await fetchDevLimiter.wait();

    try {
        // Check fetch limits before making the request
        if (manager.hasHitLimit()) {
            const error = new Error(
                `Fetch limit exceeded: ${manager.fetchCount}/${manager.config?.maxFetches ?? FetchManager.MAX_FETCHES} (${request.url})`,
            );

            console.warn(error.message);
            throw error;
        }

        // Increment counter
        manager.incrementFetchCount();

        // Log status for monitoring
        if (manager.fetchCount % 50 === 0) manager.logStatus();

        // Clone the request and inject the abort signal
        const modifiedRequest = new Request(request, {
            signal: manager.abortSignal,
        });

        try {
            return await fetch(modifiedRequest);
        } catch (error) {
            // Log failed fetches for debugging
            if (manager.isNearLimit()) {
                console.warn(`❌ Fetch failed for ${request.url}: ${error}`);
            }
            throw error;
        }
    } finally {
        // Release the limiter in dev mode
        if (dev) fetchDevLimiter.done();
    }
};

// See https://svelte.dev/docs/kit/types#app.d.ts

import type { SteamAuthenticatedAPIClient } from "$lib/server/api/steampowered/client";
import type { PrivateData, PublicData } from "$lib/server/api/steampowered/playerSummary";
import type { SteamStoreAPIClient } from "$lib/server/api/store/client";
import type { SteamUser } from "$lib/steam/data/SteamUser";
import type { KVNamespace } from "@cloudflare/workers-types";

// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            steamClient: SteamAuthenticatedAPIClient;
            steamStoreClient: SteamStoreAPIClient;
            steamUser: SteamUser | null;
        }
        // interface PageData {}
        // interface PageState {}
        interface Platform {
            env: {
                /** Used to cache Steam API responses */
                STEAM_CACHE: KVNamespace;
            };
        }
    }
}

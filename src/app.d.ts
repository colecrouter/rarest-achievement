// See https://svelte.dev/docs/kit/types#app.d.ts

import type { SteamAuthenticatedAPIClient } from "$lib/server/api/steampowered/client";
import type { SteamStoreAPIClient } from "$lib/server/api/store/client";
import type schema from "$lib/server/db/schema";
import type { SteamUser } from "$lib/steam/data/SteamUser";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import type { DrizzleD1Database } from "drizzle-orm/d1";

// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            steamClient: SteamAuthenticatedAPIClient;
            steamStoreClient: SteamStoreAPIClient;
            steamUser: SteamUser | null;
            steamCacheDB: DrizzleD1Database<typeof schema>;
        }
        // interface PageData {}
        // interface PageState {}
        interface Platform {
            env: {
                /** Used to cache Steam API responses */
                STEAM_CACHE: KVNamespace;
                DB: D1Database;
            };
        }
    }
}

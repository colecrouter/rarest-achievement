// See https://svelte.dev/docs/kit/types#app.d.ts

import type { SteamAuthenticatedAPIClient } from "$lib/steam/api/steampowered/auth/client";
import type { SteamStoreAPIClient } from "$lib/steam/api/store/client";

// for information about these interfaces
declare global {
    namespace App {
        // interface Error {}
        interface Locals {
            steamAuthenticated: SteamAuthenticatedAPIClient;
            steamStore: SteamStoreAPIClient;
        }
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

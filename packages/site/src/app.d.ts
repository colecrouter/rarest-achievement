// See https://svelte.dev/docs/kit/types#app.d.ts
import type {
	ProjectDB,
	SteamCommunityAPI,
	SteamStoreAPI,
	SteamUser,
	TranslateClient,
	VaultService,
} from "@project/lib";

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			translateClient: TranslateClient;
			steamClient: SteamAuthenticatedAPI;
			steamStoreClient: SteamStoreAPI;
			steamUser: SteamUser | null;
			steamCommunityClient: SteamCommunityAPI;
			steamCacheDB: ProjectDB;
			miscCache: KVNamespace;
			vault: VaultService;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				/** Used to cache Steam API responses */
				STEAM_CACHE: KVNamespace;
				DB: D1Database;
				GOOGLE_PROJECT_ID: string;
				AI: Ai;
			};
		}
	}
}

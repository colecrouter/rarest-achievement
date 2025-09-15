import { SteamUser, type SteamUserRaw } from "../../src";
import { makeOwnedGame } from "../fixtures/ownedData";
import { makeUserData } from "../fixtures/userData";

/**
 * Create a Steam user with optional overrides for user data and owned games.
 * @param steam_userid - The Steam user ID
 * @param user_overrides - Partial overrides for the user data
 * @param owned_overrides - Array of overrides for owned games, each consisting of [appid, includeAppInfo]
 * @returns A new SteamUser instance
 */
export function makeUser(
	steam_userid: string,
	user_overrides: Partial<SteamUserRaw> = {},
	owned_overrides: Array<Parameters<typeof makeOwnedGame>> = [],
) {
	const data = {
		...makeUserData(steam_userid),
		...user_overrides,
	};

	const ownedApps = owned_overrides.map(([appid, includeAppInfo]) => makeOwnedGame(appid, includeAppInfo));

	return new SteamUser({ data, ownedApps });
}

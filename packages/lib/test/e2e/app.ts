import { getLanguageByCode, type LanguageCode, SteamApp, type SteamAppRaw } from "../../src";
import { makeAppData } from "../fixtures/appData";

/**
 * Creates a mock SteamApp instance.
 * @param steam_appid The Steam app ID
 * @param name The name of the app
 * @param overrides Any overrides for the app data
 * @param estimated_players The estimated number of players (default: random)
 * @param langCode The language code for the app (default: "en")
 * @returns A new SteamApp instance
 */
export function makeApp(
	steam_appid: number,
	name: string,
	overrides: Partial<SteamAppRaw> = {},
	estimated_players?: number,
	langCode?: LanguageCode,
) {
	const data = {
		...makeAppData(steam_appid, name),
		...overrides,
	};

	const estimatedPlayers = estimated_players ?? Math.floor(Math.random() * 10000);
	const lang = (langCode && getLanguageByCode(langCode)?.apiCode) || "english";

	return new SteamApp({ data, estimatedPlayers, lang });
}

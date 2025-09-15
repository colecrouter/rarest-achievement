import { isBypassCdnEnabled } from "../config";
import { replaceCdnUrl } from "../config/dev";
import { parseLocalizedDate } from "../date";
import { type APILanguageCode, getLanguageByAPICode, type LanguageCode } from "../repositories";
import type { AppDetailsData, GetAppDetailsResponse } from "../repositories/api/store/appdetails";

export type SteamAppRaw = NonNullable<
	(GetAppDetailsResponse<Array<keyof AppDetailsData>> & {
		success: true;
	})[number]["data"]
>;

export class SteamApp {
	#app: SteamAppRaw;
	#estimatedPlayers: number | null;
	#lang: APILanguageCode;

	constructor({
		data,
		estimatedPlayers,
		lang,
	}: {
		data: SteamAppRaw;
		estimatedPlayers: number | null;
		lang: APILanguageCode;
	}) {
		this.#app = data;
		this.#estimatedPlayers = estimatedPlayers;
		this.#lang = lang;
	}

	get id() {
		return this.#app.steam_appid;
	}

	get name() {
		return this.#app.name;
	}

	get icon() {
		return isBypassCdnEnabled() ? replaceCdnUrl(this.#app.header_image) : this.#app.header_image;
	}

	get banner() {
		return isBypassCdnEnabled() ? replaceCdnUrl(this.#app.background) : this.#app.background;
	}

	get developers() {
		return this.#app.developers;
	}

	get publishers() {
		return this.#app.publishers;
	}

	get releaseDate() {
		const lang = getLanguageByAPICode(this.#lang)?.storeCode;
		if (!lang) throw new Error(`Unknown language code: ${this.#lang}`);

		return this.#app.release_date.coming_soon === true
			? null
			: parseLocalizedDate(this.#app.release_date.date, lang as LanguageCode);
	}

	get description() {
		return this.#app.short_description;
	}

	get estimatedPlayers() {
		return this.#estimatedPlayers;
	}

	get language() {
		const lang = getLanguageByAPICode(this.#lang);
		if (!lang) throw new Error(`Unknown language code: ${this.#lang}`);
		return lang;
	}

	serialize() {
		return {
			data: this.#app,
			estimatedPlayers: this.#estimatedPlayers,
			lang: this.#lang,
		} satisfies ConstructorParameters<typeof SteamApp>[0];
	}
}

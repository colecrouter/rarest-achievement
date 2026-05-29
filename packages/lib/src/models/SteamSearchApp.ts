import type { SearchAppsResponse } from "../repositories/api/store/searchapps";

export class SteamSearchApp {
	#appid: string;
	#name: string;
	#icon: string;
	#logo: string;

	constructor(app: SearchAppsResponse[number]) {
		this.#appid = app.appid;
		this.#name = app.name;
		this.#icon = app.icon;
		this.#logo = app.logo;
	}

	static fromArray(app: SearchAppsResponse[number][]) {
		return app.map((a) => new SteamSearchApp(a));
	}

	serialize() {
		return {
			appid: this.#appid,
			name: this.#name,
			icon: this.#icon,
			logo: this.#logo,
		} satisfies ConstructorParameters<typeof SteamSearchApp>[0];
	}

	get id() {
		return this.#appid;
	}

	get name() {
		return this.#name;
	}

	get icon() {
		return this.#icon;
	}

	get logo() {
		return this.#logo;
	}
}

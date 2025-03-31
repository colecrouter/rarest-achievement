import type { AppDetailsData, GetAppDetailsResponse } from "$lib/server/api/store/appdetails";

type SteamAppData = (GetAppDetailsResponse<Array<keyof AppDetailsData>> & { success: true })[string]["data"];

export class SteamApp {
    #app: SteamAppData;
    #lang: string;

    constructor(data: SteamAppData, lang: string) {
        this.#app = data;
        this.#lang = lang;
    }

    serialize() {
        return { app: this.#app, lang: this.#lang };
    }

    get id() {
        return this.#app.steam_appid;
    }

    get name() {
        return this.#app.name;
    }

    get icon() {
        return this.#app.header_image;
    }

    get banner() {
        return this.#app.background;
    }

    get developers() {
        return this.#app.developers;
    }

    get publishers() {
        return this.#app.publishers;
    }

    get releaseDate() {
        return this.#app.release_date.coming_soon === true ? null : new Date(this.#app.release_date.date);
    }

    get description() {
        return this.#app.short_description;
    }
}

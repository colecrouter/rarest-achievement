import type { AppDetailsData, GetAppDetailsResponse } from "$lib/server/api/store/appdetails";

export type SteamAppRaw = (GetAppDetailsResponse<Array<keyof AppDetailsData>> & { success: true })[string]["data"];

export class SteamApp {
    #app: SteamAppRaw;

    constructor(data: SteamAppRaw) {
        this.#app = data;
    }

    serialize() {
        return { app: this.#app };
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

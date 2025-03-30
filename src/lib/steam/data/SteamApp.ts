import { browser } from "$app/environment";
import type { AppDetailsData, GetAppDetailsResponse } from "$lib/server/api/store/appdetails";
import { SteamAppAchievement } from "$lib/steam/data/SteamAppAchievement";
import { SteamUserAchievement } from "$lib/steam/data/SteamUserAchievement";

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

    static async fetchSteamApp(appId: number, lang = "english") {
        if (!browser) {
            const { getRequestEvent } = await import("$app/server");
            const { locals } = getRequestEvent();
            const { steamStoreClient } = locals;
            const data1 = await steamStoreClient.getAppDetails(appId, { l: lang });
            const data = data1[appId.toString()];
            if (!data.success) {
                throw new Error("Failed to fetch Steam app details.");
            }
            return new SteamApp(data.data, lang);
        }

        throw new Error("Cannot fetch Steam app details in a browser context.");
    }

    async getAchievements() {
        return SteamAppAchievement.fetchAppAchievements(this, this.#lang);
    }

    async getUserAchievements(userId: string) {
        return SteamUserAchievement.fetchUserAchievements(this, userId, this.#lang);
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

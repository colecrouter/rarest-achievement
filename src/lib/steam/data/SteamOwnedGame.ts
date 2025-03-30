import { browser } from "$app/environment";
import type { OwnedGame } from "$lib/server/api/steampowered/owned";

export class SteamOwnedGame {
    #owned: OwnedGame<true>;

    constructor(data: OwnedGame<true>) {
        this.#owned = data;
    }

    serialize() {
        return {
            owned: this.#owned,
        };
    }

    static async fetchOwnedGames(steamId: string) {
        if (!browser) {
            const { getRequestEvent } = await import("$app/server");
            const { locals } = getRequestEvent();

            const { steamClient } = locals;

            const { response } = await steamClient.getOwnedGames({
                steamid: steamId,
                include_appinfo: true,
                include_played_free_games: true,
            });

            if (!response.game_count) return [];

            const { games } = response;
            // TODO
            return games?.map((game) => new SteamOwnedGame(game)) ?? [];
        }

        throw new Error("Cannot fetch owned game in a browser context.");
    }

    async getApp() {
        if (!browser) {
            const { SteamApp } = await import("$lib/steam/data/SteamApp");
            const app = await SteamApp.fetchSteamApp(this.#owned.appid, "english");
            return app;
        }

        throw new Error("Cannot fetch app in a browser context.");
    }

    get id() {
        return this.#owned.appid;
    }

    get playtime() {
        return this.#owned.playtime_forever;
    }

    get playtime2Weeks() {
        return this.#owned.playtime_2weeks;
    }
}

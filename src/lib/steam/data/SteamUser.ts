import { getRequestEvent } from "$app/server";
import type { GetPlayerSummariesResponse } from "$lib/server/api/steampowered/playerSummary";
import { SteamApp } from "$lib/steam/data/SteamApp";

type UserData = GetPlayerSummariesResponse["response"]["players"][number];

export class SteamUser {
    #player: UserData;

    constructor(data: UserData) {
        this.#player = data;
    }

    serialize() {
        return {
            player: this.#player,
        };
    }

    static async fetchUser(steamId: string) {
        const { locals } = getRequestEvent();

        const { steamClient } = locals;

        const { response } = await steamClient.getPlayerSummaries([steamId]);
        if (response.players.length === 0) {
            return null;
        }

        return new SteamUser(response.players[0]);
    }

    async getOwnedGames() {
        const { locals } = getRequestEvent();

        const { steamClient } = locals;

        const { response } = await steamClient.getOwnedGames({
            steamid: this.#player.steamid,
            include_appinfo: true,
            include_played_free_games: true,
        });
        const { games } = response;

        const gamesList = new Array<SteamApp>();
        for (const game of games) {
            const app = await SteamApp.fetchSteamApp(game.appid, "english");
            if (!app) continue;
            gamesList.push(app);
        }

        return gamesList;
    }
}

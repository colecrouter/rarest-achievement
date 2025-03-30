import { browser } from "$app/environment";
import type { GetPlayerSummariesResponse } from "$lib/server/api/steampowered/playerSummary";
import { SteamApp } from "$lib/steam/data/SteamApp";
import { SteamOwnedGame } from "$lib/steam/data/SteamOwnedGame";

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
        if (!browser) {
            const { getRequestEvent } = await import("$app/server");
            const { locals } = getRequestEvent();

            const { steamClient } = locals;

            const { response } = await steamClient.getPlayerSummaries([steamId]);
            if (response.players.length === 0) {
                return null;
            }

            return new SteamUser(response.players[0]);
        }

        throw new Error("Cannot fetch user in a browser context.");
    }

    async getOwnedGames() {
        return SteamOwnedGame.fetchOwnedGames(this.#player.steamid);
    }

    async getFriends() {
        if (!browser) {
            const { getRequestEvent } = await import("$app/server");
            const { locals } = getRequestEvent();

            const { steamClient } = locals;

            const { friendslist } = await steamClient.getFriendsList({
                relationship: "friend",
                steamid: this.#player.steamid,
            });

            const friendsList = new Array<SteamUser>();
            for (const friend of friendslist.friends) {
                const friendData = await SteamUser.fetchUser(friend.steamid);
                if (!friendData) continue;
                friendsList.push(friendData);
            }

            return friendsList;
        }

        throw new Error("Cannot get friends in a browser context.");
    }

    async getAchievements(appId: number) {
        const app = await SteamApp.fetchSteamApp(appId);
        return app.getUserAchievements(this.#player.steamid);
    }

    get id() {
        return this.#player.steamid;
    }

    get displayName() {
        return this.#player.personaname;
    }

    get avatar() {
        return this.#player.avatarfull;
    }

    get profileUrl() {
        return this.#player.profileurl;
    }

    get lastLogOff() {
        return new Date(this.#player.lastlogoff * 1000);
    }

    get status() {
        return this.#player.personastate as SteamUserStatus;
    }
}

export enum SteamUserStatus {
    Offline = 0,
    Online = 1,
    Busy = 2,
    Away = 3,
    Snooze = 4,
    LookingToTrade = 5,
    LookingToPlay = 6,
    Max = 7,
}

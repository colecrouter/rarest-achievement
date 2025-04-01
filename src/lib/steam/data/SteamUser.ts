import type { GetPlayerSummariesResponse } from "$lib/server/api/steampowered/playerSummary";

export type SteamUserRaw = GetPlayerSummariesResponse["response"]["players"][number];

export class SteamUser {
    #player: SteamUserRaw;

    constructor(data: SteamUserRaw) {
        this.#player = data;
    }

    serialize() {
        return {
            player: this.#player,
        };
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

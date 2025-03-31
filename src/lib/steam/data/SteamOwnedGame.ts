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

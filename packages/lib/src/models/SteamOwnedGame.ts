import type { OwnedGame } from "../repositories/api/steampowered/owned";

export class SteamOwnedGame {
    #owned: OwnedGame<false>;

    constructor(data: OwnedGame<false>) {
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

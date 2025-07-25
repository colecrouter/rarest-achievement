import type { OwnedGame } from "../repositories/api/steampowered/owned";

export class SteamOwnedGame {
    #owned: OwnedGame<false>;

    constructor({ owned }: { owned: OwnedGame<false> }) {
        this.#owned = owned;
    }

    serialize() {
        return {
            owned: this.#owned,
        } satisfies ConstructorParameters<typeof SteamOwnedGame>[0];
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

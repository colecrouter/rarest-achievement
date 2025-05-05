import { isBypassCdnEnabled } from "../config";
import { replaceCdnUrl } from "../config/dev";

export class SteamSearchUser {
    #name: string;
    #userId: string;
    #avatarUrl: string;

    constructor(user: { name: string; userId: string; avatarUrl: string }) {
        this.#name = user.name;
        this.#userId = user.userId;
        this.#avatarUrl = user.avatarUrl;
    }

    static fromArray(users: { name: string; userId: string; avatarUrl: string }[]) {
        return users.map((user) => new SteamSearchUser(user));
    }

    serialize() {
        return [
            {
                name: this.#name,
                userId: this.#userId,
                avatarUrl: this.#avatarUrl,
            },
        ] satisfies ConstructorParameters<typeof SteamSearchUser>;
    }

    get id() {
        return this.#userId;
    }

    get name() {
        return this.#name;
    }

    get avatar() {
        return isBypassCdnEnabled() ? replaceCdnUrl(this.#avatarUrl) : this.#avatarUrl;
    }
}

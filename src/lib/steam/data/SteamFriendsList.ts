import type { GetFriendsListResponse } from "$lib/server/api/steampowered/friends";

export type SteamFriendsListRaw = GetFriendsListResponse["friendslist"]["friends"];

export class SteamFriendsList {
    #steamid: string;
    #friends: SteamFriendsListRaw;

    constructor(steamid: string, friends: SteamFriendsListRaw) {
        this.#steamid = steamid;
        this.#friends = friends;
    }

    serialize() {
        return {
            steamid: this.#steamid,
            friends: this.#friends,
        };
    }

    get steamid() {
        return this.#steamid;
    }

    get friends() {
        return this.#friends.map((f) => f.steamid);
    }

    get friendCount() {
        return this.#friends.length;
    }
}

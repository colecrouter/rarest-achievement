import type { GetFriendsListResponse } from "../repositories/api/steampowered/friends";
import type { OwnedGame } from "../repositories/api/steampowered/owned";
import { SteamUser, type SteamUserRaw } from "./SteamUser";

type Raw = GetFriendsListResponse["friendslist"]["friends"][number];

export class SteamFriendUser extends SteamUser {
	#friendData: Raw;
	#friend: SteamUser;

	constructor({
		data,
		ownedApps,
		friendData,
		friend,
	}: {
		data: SteamUserRaw;
		ownedApps: OwnedGame<false>[];
		friendData: Raw;
		friend: SteamUser;
	}) {
		super({ data, ownedApps });
		this.#friendData = friendData;
		this.#friend = friend;
	}

	serialize() {
		return {
			...super.serialize(),
			friendData: this.#friendData,
			friend: this.#friend,
		} satisfies ConstructorParameters<typeof SteamFriendUser>[0];
	}

	get friend() {
		return this.#friend;
	}

	get friendSince() {
		return new Date(this.#friendData.friend_since * 1000);
	}
}

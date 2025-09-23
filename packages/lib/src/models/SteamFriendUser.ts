import type { GetFriendsListResponse } from "../repositories/api/steampowered/friends";
import type { OwnedGame } from "../repositories/api/steampowered/owned";
import { SteamUser, type SteamUserRaw } from "./SteamUser";

type Raw = GetFriendsListResponse["friendslist"]["friends"][number];

export class SteamFriendUser<WithOwnedApps extends boolean = boolean> extends SteamUser<WithOwnedApps> {
	#friendData: Raw;
	#friend: SteamUser<false>;

	constructor({
		data,
		ownedApps,
		friendData,
		friend,
	}: {
		data: SteamUserRaw;
		ownedApps: WithOwnedApps extends true ? OwnedGame<false>[] : never;
		friendData: Raw;
		friend: SteamUser<false>;
	}) {
		super({ data, ownedApps });
		this.#friendData = friendData;
		this.#friend = friend;
	}

	serialize(): ConstructorParameters<typeof SteamFriendUser<WithOwnedApps>>[0] {
		return {
			...super.serialize(),
			friendData: this.#friendData,
			friend: this.#friend,
		};
	}

	get friend() {
		return this.#friend;
	}

	get friendSince() {
		return new Date(this.#friendData.friend_since * 1000);
	}
}

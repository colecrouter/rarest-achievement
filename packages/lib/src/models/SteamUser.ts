import { isBypassCdnEnabled } from "../config/cdnConfig";
import { replaceCdnUrl } from "../config/dev";
import type { OwnedGame } from "../repositories/api/steampowered/owned";
import type { GetPlayerSummariesResponse } from "../repositories/api/steampowered/playerSummary";
import { SteamOwnedGame } from "./SteamOwnedGame";

export type SteamUserRaw = GetPlayerSummariesResponse["response"]["players"][number];

export class SteamUser<WithOwnedApps extends boolean = boolean> {
	#player: SteamUserRaw;
	#ownedApps: WithOwnedApps extends true ? OwnedGame<false>[] : never;

	constructor({
		data,
		ownedApps,
	}: {
		data: SteamUserRaw;
		ownedApps: WithOwnedApps extends true ? OwnedGame<false>[] : never;
	}) {
		this.#player = data;
		this.#ownedApps = ownedApps;
	}

	serialize(): ConstructorParameters<typeof SteamUser<WithOwnedApps>>[0] {
		return {
			data: this.#player,
			ownedApps: this.#ownedApps,
		} satisfies ConstructorParameters<typeof SteamUser<WithOwnedApps>>[0];
	}

	get id() {
		return this.#player.steamid;
	}

	get displayName() {
		return this.#player.personaname;
	}

	get avatar() {
		return isBypassCdnEnabled() ? replaceCdnUrl(this.#player.avatarfull) : this.#player.avatarfull;
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

	/** Note that this isn't reliable; my API key will false negative users who I am friends with, even though I can't fetch all of their data. */
	get private() {
		return this.#player.communityvisibilitystate !== 3;
	}

	get realName() {
		return "realname" in this.#player ? this.#player.realname : undefined;
	}

	get created() {
		return "timecreated" in this.#player ? new Date(this.#player.timecreated * 1000) : undefined;
	}

	get lastLoggedIn() {
		return "lastlogoff" in this.#player ? new Date(this.#player.lastlogoff * 1000) : undefined;
	}

	get ownedApps() {
		return (this.#ownedApps ?? []).map((app) => new SteamOwnedGame({ owned: app }));
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

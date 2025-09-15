import type { APILanguageCode } from "../lang";
import type { GetPlayerAchievementsResponse } from "../repositories/api/steampowered/playerAchievement";
import type { SteamApp } from "./SteamApp";
import {
	type SteamAchievementRawGlobalStats,
	type SteamAchievementRawMeta,
	SteamAppAchievement,
} from "./SteamAppAchievement";
import type { SteamUser } from "./SteamUser";

export type SteamUserAchievementRawStats = NonNullable<
	GetPlayerAchievementsResponse<undefined>
>["playerstats"]["achievements"][number];

export class SteamUserAchievement extends SteamAppAchievement {
	#userStats: SteamUserAchievementRawStats | null;
	#user?: SteamUser;

	constructor({
		app,
		meta,
		globalStats,
		lang,
		user,
		userStats,
	}: {
		app: SteamApp;
		meta: SteamAchievementRawMeta;
		globalStats: SteamAchievementRawGlobalStats;
		lang: APILanguageCode;
		user?: SteamUser;
		userStats: SteamUserAchievementRawStats | null;
	}) {
		super({ app, meta, globalStats, lang });
		this.#user = user;
		this.#userStats = userStats;
	}

	serialize(): ConstructorParameters<typeof SteamUserAchievement>[0] {
		const base = super.serialize();
		return { ...base, user: this.#user, userStats: this.#userStats };
	}

	get user() {
		return this.#user;
	}

	get unlocked() {
		return this.#userStats && this.#userStats.achieved === 1 && this.#userStats.unlocktime !== 0
			? new Date(this.#userStats.unlocktime * 1000)
			: null;
	}

	get icon() {
		return this.unlocked ? super.iconUnlocked : this.iconLocked;
	}
}

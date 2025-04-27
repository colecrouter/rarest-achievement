import type { GetPlayerAchievementsResponse } from "../repositories/api/steampowered/playerAchievement";
import type { SteamApp } from "./SteamApp";
import {
    type SteamAchievementRawGlobalStats,
    type SteamAchievementRawMeta,
    SteamAppAchievement,
} from "./SteamAppAchievement";

export type SteamUserAchievementRawStats = NonNullable<
    GetPlayerAchievementsResponse<undefined>
>["playerstats"]["achievements"][number];

export class SteamUserAchievement extends SteamAppAchievement {
    #steamid: string;
    #userStats: SteamUserAchievementRawStats | null;

    constructor(
        game: SteamApp,
        meta: SteamAchievementRawMeta,
        global: SteamAchievementRawGlobalStats,
        lang: string,
        steamid: string,
        userStats: SteamUserAchievementRawStats | null,
    ) {
        super(game, meta, global, lang);
        this.#steamid = steamid;
        this.#userStats = userStats;
    }

    serializeUser() {
        const base = super.serialize();
        return [...base, this.#steamid, this.#userStats] as ConstructorParameters<typeof SteamUserAchievement>;
    }

    get unlocked() {
        return this.#userStats && this.#userStats.unlocktime !== 0 ? new Date(this.#userStats.unlocktime * 1000) : null;
    }

    get icon() {
        return this.unlocked ? super.iconUnlocked : this.iconLocked;
    }
}

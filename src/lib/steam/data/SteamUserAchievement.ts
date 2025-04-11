import type { GetPlayerAchievementsResponse } from "$lib/server/api/steampowered/playerAchievement";
import type { SteamApp } from "$lib/steam/data/SteamApp";
import {
    type SteamAchievementRawGlobalStats,
    type SteamAchievementRawMeta,
    SteamAppAchievement,
} from "$lib/steam/data/SteamAppAchievement";

export type SteamUserAchievementRawStats = NonNullable<
    GetPlayerAchievementsResponse<undefined>
>["playerstats"]["achievements"][number];

export class SteamUserAchievement extends SteamAppAchievement {
    #steamid: string;
    #userStats: SteamUserAchievementRawStats | null;

    constructor(
        game: SteamApp,
        steamid: string,
        meta: SteamAchievementRawMeta,
        global: SteamAchievementRawGlobalStats,
        userStats: SteamUserAchievementRawStats | null,
        lang: string,
    ) {
        super(game, meta, global, lang);
        this.#steamid = steamid;
        this.#userStats = userStats;
    }

    serialize() {
        const { app, stats, global, lang } = super.serialize();
        return {
            app,
            stats,
            global,
            lang,
            userStats: this.#userStats,
            steamid: this.#steamid,
        };
    }

    get unlocked() {
        return this.#userStats && this.#userStats.unlocktime !== 0 ? new Date(this.#userStats.unlocktime * 1000) : null;
    }

    get icon() {
        return this.unlocked ? super.iconUnlocked : this.iconLocked;
    }
}

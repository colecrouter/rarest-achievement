import type { GetPlayerAchievementsResponse } from "$lib/server/api/steampowered/playerAchievement";
import type { SteamApp } from "$lib/steam/data/SteamApp";
import {
    type AchievementGlobalStats,
    type AchievementMeta,
    SteamAppAchievement,
} from "$lib/steam/data/SteamAppAchievement";

type AchievementUserStats = NonNullable<GetPlayerAchievementsResponse<string>>["playerstats"]["achievements"][number];

export class SteamUserAchievement extends SteamAppAchievement {
    #steamid: string;
    #userStats: AchievementUserStats | null;

    constructor(
        game: SteamApp,
        steamid: string,
        stats: AchievementMeta,
        global: AchievementGlobalStats,
        userStats: AchievementUserStats | null,
        lang: string,
    ) {
        super(game, stats, global, lang);
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
}

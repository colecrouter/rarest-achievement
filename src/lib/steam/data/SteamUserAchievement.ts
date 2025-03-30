import { getRequestEvent } from "$app/server";
import type { GetPlayerAchievementsResponse } from "$lib/server/api/steampowered/playerAchievement";
import type { SteamApp } from "$lib/steam/data/SteamApp";
import {
    SteamAppAchievement,
    type AchievementGlobalStats,
    type AchievementMeta,
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

    static async fetchUserAchievements(game: SteamApp, userId: string, lang = "english") {
        const { locals } = getRequestEvent();

        const { steamClient } = locals;

        const schema = await steamClient.getSchemaForGame({ appid: game.appId, l: lang }).catch(() => null);
        if (!schema) return [];

        const achievementPercentages = await steamClient
            .getGlobalAchievementPercentagesForApp({
                gameid: game.appId,
            })
            .catch(() => null);
        if (!achievementPercentages) return [];
        const userAchievements = await steamClient
            .getPlayerAchievements({
                steamid: userId,
                appid: game.appId,
            })
            .catch(() => null);

        // Notice how we don't throw if userAchievements is empty
        if (!schema || !achievementPercentages) {
            throw new Error("Failed to fetch schema or achievement percentages.");
        }

        const stats = schema.game.availableGameStats?.achievements;
        if (!stats) return [];

        const achievements = new Array<SteamUserAchievement>();
        for (const stat of stats) {
            const global = achievementPercentages.achievementpercentages.achievements.find(
                (achievement) => achievement.name === stat.name,
            );
            if (!global) throw new Error("No global achievement found.");

            const userStat = userAchievements?.playerstats.achievements.find(
                (achievement) => achievement.apiname === stat.name,
            );
            achievements.push(new SteamUserAchievement(game, userId, stat, global, userStat ?? null, lang));
        }
        return achievements;
    }

    get unlocked() {
        return this.#userStats && this.#userStats?.unlocktime !== 0
            ? new Date(this.#userStats.unlocktime * 1000)
            : null;
    }
}

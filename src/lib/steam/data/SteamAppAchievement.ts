import { getRequestEvent } from "$app/server";
import type { GetGlobalAchievementPercentagesForAppResponse } from "$lib/server/api/steampowered/globalAchevement";
import type { GetSchemaForGameResponse } from "$lib/server/api/steampowered/schemaForGame";
import type { SteamApp } from "$lib/steam/data/SteamApp";

export type AchievementMeta = NonNullable<
    NonNullable<NonNullable<GetSchemaForGameResponse>["game"]["availableGameStats"]>["achievements"]
>[number];

export type AchievementGlobalStats =
    NonNullable<GetGlobalAchievementPercentagesForAppResponse>["achievementpercentages"]["achievements"][number];

export class SteamAppAchievement {
    #app: SteamApp;
    #meta: AchievementMeta;
    #globalStats: AchievementGlobalStats;
    #lang: string;

    constructor(app: SteamApp, stats: AchievementMeta, global: AchievementGlobalStats, lang: string) {
        this.#app = app;
        this.#meta = stats;
        this.#globalStats = global;
        this.#lang = lang;
    }

    serialize() {
        return {
            app: this.#app,
            stats: this.#meta,
            global: this.#globalStats,
            lang: this.#lang,
        };
    }

    static async fetchAppAchievements(game: SteamApp, lang = "english") {
        const { locals } = getRequestEvent();

        const { steamClient } = locals;

        const schema = await steamClient.getSchemaForGame({ appid: game.appId, l: lang });
        const achievementPercentages = await steamClient.getGlobalAchievementPercentagesForApp({
            gameid: game.appId,
        });

        if (!schema || !achievementPercentages) {
            throw new Error("Failed to fetch schema or achievement percentages.");
        }

        const stats = schema.game.availableGameStats?.achievements;
        if (!stats) throw new Error("No achievements found in schema.");

        const achievements = new Array<SteamAppAchievement>();
        for (const stat of stats) {
            const global = achievementPercentages.achievementpercentages.achievements.find(
                (achievement) => achievement.name === stat.name,
            );
            if (!global) throw new Error("No global achievement found.");

            if (global) {
                achievements.push(new SteamAppAchievement(game, stat, global, lang));
            }
        }
        return achievements;
    }

    get internalName() {
        return this.#meta.name;
    }

    get displayName() {
        return this.#meta.displayName;
    }

    get icon() {
        return this.#meta.icon;
    }

    get description() {
        return this.#meta.description;
    }

    get globalPercentage() {
        return this.#globalStats.percent;
    }

    get app() {
        return this.#app;
    }
}

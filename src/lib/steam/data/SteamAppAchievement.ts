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

    get id() {
        return this.#meta.name;
    }

    get name() {
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

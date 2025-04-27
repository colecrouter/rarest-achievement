import { isBypassCdnEnabled } from "../config/cdnConfig";
import { replaceCdnUrl } from "../config/dev";
import type { GetGlobalAchievementPercentagesForAppResponse } from "../repositories/api/steampowered/globalAchevement";
import type { GetSchemaForGameResponse } from "../repositories/api/steampowered/schemaForGame";
import type { SteamApp } from "./SteamApp";

export type SteamAchievementRawMeta = NonNullable<
    NonNullable<NonNullable<GetSchemaForGameResponse>["game"]["availableGameStats"]>["achievements"]
>[number];

export type SteamAchievementRawGlobalStats =
    NonNullable<GetGlobalAchievementPercentagesForAppResponse>["achievementpercentages"]["achievements"][number];

export class SteamAppAchievement {
    #app: SteamApp;
    #meta: SteamAchievementRawMeta;
    #globalStats: SteamAchievementRawGlobalStats;
    #lang: string;

    constructor(app: SteamApp, stats: SteamAchievementRawMeta, global: SteamAchievementRawGlobalStats, lang: string) {
        this.#app = app;
        this.#meta = stats;
        this.#globalStats = global;
        this.#lang = lang;
    }

    serialize() {
        return [this.#app, this.#meta, this.#globalStats, this.#lang] satisfies ConstructorParameters<
            typeof SteamAppAchievement
        >;
    }

    get id() {
        return this.#meta.name;
    }

    get name() {
        return this.#meta.displayName;
    }

    get iconUnlocked() {
        // Previously:
        // return bypassCdn ? replaceCdnUrl(this.#meta.icon) : this.#meta.icon;
        return isBypassCdnEnabled() ? replaceCdnUrl(this.#meta.icon) : this.#meta.icon;
    }

    get iconLocked() {
        // Previously:
        // return bypassCdn ? replaceCdnUrl(this.#meta.icongray) : this.#meta.icongray;
        return isBypassCdnEnabled() ? replaceCdnUrl(this.#meta.icongray) : this.#meta.icongray;
    }

    get icon() {
        return this.iconUnlocked;
    }

    get description() {
        return this.#meta.description;
    }

    get globalPercentage() {
        return this.#globalStats.percent;
    }

    get globalCount() {
        return this.#app.estimatedPlayers ? this.#app.estimatedPlayers * (this.#globalStats.percent / 100) : null;
    }

    get app() {
        return this.#app;
    }

    get hidden() {
        return !!this.#meta.hidden;
    }
}

import type { KVNamespace } from "@cloudflare/workers-types";
import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import { Errable } from "../../..";
import type { Language } from "../lang";
import { SteamCommunityClient } from "./client";
import type { Article } from "./scrape";

export class SteamCommunityRepo {
    #cache: KVNamespace;

    constructor(cache: KVNamespace) {
        this.#cache = cache;
    }

    async searchGuides(achievement: SteamAppAchievement | SteamUserAchievement, lang: Language) {
        const cacheKey = `steamcommunity:${achievement.app.id}:${achievement.id}:${lang}`;
        const cached = await this.#cache.get(cacheKey);
        if (cached) {
            const data = JSON.parse(cached) as Article[];
            return new Errable(data, null);
        }

        const articles = await Errable.try(async () => {
            const articles = await SteamCommunityClient.fetchArticles(achievement, lang, 5);
            await this.#cache.put(cacheKey, JSON.stringify(articles), {
                expirationTtl: 60 * 60 * 24,
            }); // Cache for 24 hours
            return articles;
        });

        await this.#cache.put(cacheKey, JSON.stringify(articles.data), {
            expirationTtl: 60 * 60 * 24,
        }); // Cache for 24 hours

        return articles;
    }
}

import type { KVNamespace } from "@cloudflare/workers-types";
import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import { Errable } from "../../../error";
import type { Language } from "../lang";
import { YouTubeClient } from "./client";

export class YouTubeRepository {
    #client: YouTubeClient;
    #cache: KVNamespace;

    constructor(apiKey: string, cache: KVNamespace) {
        this.#client = new YouTubeClient(apiKey);
        this.#cache = cache;
    }

    async searchGuides(achievement: SteamAppAchievement | SteamUserAchievement, lang: Language) {
        const cacheKey = `youtube:${achievement.app.id}:${achievement.id}:${lang}`;
        const cached = await this.#cache.get(cacheKey);
        if (cached) {
            const { data, error } = JSON.parse(cached) as {
                data: YouTubeGuide[];
                error: string | null;
            };
            return new Errable(data, error ? new Error(error) : null);
        }

        const guides = await Errable.try(async () => {
            const guides = await this.#client.fetchVideos(achievement, lang, 5);
            return guides.items.map((item) => ({
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                description: item.snippet.description,
                publishedAt: item.snippet.publishedAt,
                videoId: item.id.kind === "youtube#video" ? item.id.videoId : "",
            })) satisfies YouTubeGuide[];
        });

        await this.#cache.put(cacheKey, JSON.stringify({ data: guides.data, error: guides.error }), {
            expirationTtl: 60 * 60 * 24,
        }); // Cache for 24 hours

        return guides;
    }
}

export interface YouTubeGuide {
    title: string;
    channel: string;
    description: string;
    publishedAt: string;
    videoId: string;
}

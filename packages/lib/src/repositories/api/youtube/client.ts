import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import type { Language } from "../lang";
import type { ISearchResponse } from "./types/ISearchResponse";

export class YouTubeClient {
    #apiKey: string;

    constructor(apiKey: string) {
        this.#apiKey = apiKey;
    }

    async fetchVideos(achievement: SteamAppAchievement | SteamUserAchievement, lang: Language, maxResults: number) {
        if (maxResults < 0 || maxResults > 50) throw new Error("maxResults must be between 0 and 50");

        const query = `${achievement.app.name} ${achievement.name}`;

        const url = new URL("https://www.googleapis.com/youtube/v3/search");
        url.searchParams.set("q", query);
        url.searchParams.set("part", "snippet");
        url.searchParams.set("maxResults", "10");
        url.searchParams.set("key", this.#apiKey);
        url.searchParams.set("type", "video");
        url.searchParams.set("order", "relevance");
        url.searchParams.set("safeSearch", "moderate");
        // url.searchParams.set("relevanceLanguage", "en"); // TODO
        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.statusText}`);
        }

        return response.json() as Promise<ISearchResponse>;
    }
}

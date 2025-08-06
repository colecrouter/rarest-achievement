import type { LanguageCode } from "../../../lang";
import type { SteamAppAchievement, SteamUserAchievement } from "../../../models";
import type { ISearchResponse } from "./types/ISearchResponse";

export interface YouTubeAPI {
    fetchVideos(
        achievement: SteamAppAchievement | SteamUserAchievement,
        lang: LanguageCode,
        maxResults: number,
    ): Promise<ISearchResponse>;
}

export class YouTubeClient implements YouTubeAPI {
    #apiKey: string;

    constructor(apiKey: string) {
        this.#apiKey = apiKey;
    }

    async fetchVideos(achievement: SteamAppAchievement | SteamUserAchievement, lang: LanguageCode, maxResults: number) {
        if (maxResults < 0 || maxResults > 50) throw new Error("maxResults must be between 0 and 50");

        const url = new URL("https://www.googleapis.com/youtube/v3/search");
        url.searchParams.set("q", `${achievement.app.name} ${achievement.name}`);
        url.searchParams.set("part", "snippet");
        url.searchParams.set("maxResults", maxResults.toString());
        url.searchParams.set("key", this.#apiKey);
        url.searchParams.set("type", "video");
        url.searchParams.set("order", "relevance");
        url.searchParams.set("safeSearch", "moderate");
        url.searchParams.set("relevanceLanguage", lang);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`YouTube API error: ${response.statusText}`);

        return response.json() as Promise<ISearchResponse>;
    }
}

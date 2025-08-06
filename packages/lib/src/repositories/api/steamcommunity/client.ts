import type { APILanguageCode } from "../../../lang";
import type { SteamAppAchievement, SteamUserAchievement } from "../../../models";
import { scrapeSteamCommunityArticles } from "./articles";
import type { Article, User } from "./types";
import { searchSteamCommunityUsers } from "./users";

export interface SteamCommunityAPI {
    fetchArticles(
        achievement: SteamAppAchievement | SteamUserAchievement,
        lang: APILanguageCode,
        maxLength: number,
    ): Promise<Article[]>;
    searchUsers(text: string, page?: number): Promise<{ users: User[]; total: number }>;
}

class SteamCommunityClient implements SteamCommunityAPI {
    async fetchArticles(
        achievement: SteamAppAchievement | SteamUserAchievement,
        lang: APILanguageCode,
        maxLength: number,
    ) {
        if (maxLength < 0 || maxLength > 10) throw new Error("maxLength must be between 0 and 10");

        const data = await scrapeSteamCommunityArticles(achievement, lang);

        return data.slice(0, maxLength);
    }

    async searchUsers(text: string, page = 1): Promise<{ users: User[]; total: number }> {
        return await searchSteamCommunityUsers(text, page);
    }
}

const client = new SteamCommunityClient();

export { client as SteamCommunityAPIClient };

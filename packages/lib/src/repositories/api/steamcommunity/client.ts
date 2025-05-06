import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import type { Language } from "../lang";
import { scrapeSteamCommunityArticles } from "./articles";
import type { User } from "./types";
import { searchSteamCommunityUsers } from "./users";

export class SteamCommunityClient {
    static async fetchArticles(
        achievement: SteamAppAchievement | SteamUserAchievement,
        lang: Language,
        maxLength: number,
    ) {
        if (maxLength < 0 || maxLength > 10) throw new Error("maxLength must be between 0 and 10");

        const data = await scrapeSteamCommunityArticles(achievement, lang);

        return data.slice(0, maxLength);
    }

    static async searchUsers(text: string, page = 1): Promise<{ users: User[]; total: number }> {
        return await searchSteamCommunityUsers(text, page);
    }
}

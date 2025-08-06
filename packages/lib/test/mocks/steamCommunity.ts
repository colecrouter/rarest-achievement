// Centralized fixture for SteamCommunityAPI

import type { SteamCommunityAPI } from "../../src/repositories/api/steamcommunity/client";
import type { SteamAppAchievement, SteamUserAchievement } from "../../src/models";
import type { Article, User } from "../../src/repositories/api/steamcommunity/types";
import type { APILanguageCode } from "../../src/lang";

export class MockSteamCommunityAPIClient implements SteamCommunityAPI {
    // internal stores
    private articles = new Map<string, Article[]>();
    private users = new Map<string, { users: User[]; total: number }>();

    /**
     * Set fixture for fetchArticles
     */
    setArticles(achievement: SteamAppAchievement | SteamUserAchievement, lang: APILanguageCode, response: Article[]) {
        const key = JSON.stringify({ id: achievement.serialize(), lang });
        this.articles.set(key, response);
    }

    async fetchArticles(
        achievement: SteamAppAchievement | SteamUserAchievement,
        lang: APILanguageCode,
        maxLength: number,
    ): Promise<Article[]> {
        const key = JSON.stringify({ id: achievement.serialize(), lang });
        const list = this.articles.get(key) ?? [];
        return list.slice(0, maxLength);
    }

    /**
     * Set fixture for searchUsers
     */
    setSearchUsers(text: string, page: number, response: { users: User[]; total: number }) {
        const key = `${text}:${page}`;
        this.users.set(key, response);
    }

    async searchUsers(text: string, page = 1): Promise<{ users: User[]; total: number }> {
        const key = `${text}:${page}`;
        return this.users.get(key) ?? { users: [], total: 0 };
    }
}

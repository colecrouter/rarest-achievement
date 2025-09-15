import {
	Attempt,
	getLanguageByCode,
	type SteamAppAchievement,
	type SteamCommunityAPI,
	type SteamUserAchievement,
} from "../../..";
import type { APILanguageCode } from "../../../lang";
import type { Article, User } from "./types";

export class SteamCommunityRepo {
	constructor(
		private cache: KVNamespace,
		private api: SteamCommunityAPI,
	) {}

	async searchGuides(achievement: SteamAppAchievement | SteamUserAchievement) {
		// Non-english searching seems very inconsistent for now
		const lang = getLanguageByCode("en")?.apiCode as APILanguageCode;

		const cacheKey = `steamcommunity:${achievement.app.id}:${achievement.id}:${lang}`;
		const cached = await this.cache.get(cacheKey);
		if (cached) {
			const data = JSON.parse(cached) as Article[];

			return Attempt.ok(data);
		}

		const articles = await Attempt.try(async () => {
			const articles = await this.api.fetchArticles(achievement, lang, 5);
			await this.cache.put(cacheKey, JSON.stringify(articles), {
				expirationTtl: 60 * 60 * 24,
			}); // Cache for 24 hours
			return articles;
		});

		return articles;
	}

	async searchUsers(text: string, page = 1) {
		const cacheKey = `steamcommunity:users:${text}:${page}`;
		const cached = await this.cache.get(cacheKey);
		if (cached) {
			const data = JSON.parse(cached) as User[];
			return Attempt.ok(data);
		}

		const users = await Attempt.try(async () => {
			const users = await this.api.searchUsers(text, page);
			await this.cache.put(cacheKey, JSON.stringify(users), {
				expirationTtl: 60 * 60 * 24,
			});
			return users;
		});

		return users;
	}
}

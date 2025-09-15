import type { SteamAppAchievement } from "../../../";
import type { LanguageCode } from "../../../lang";
import type { TranslateClient } from "./client";

export class TranslateRepository {
	#client: TranslateClient;
	#cache: KVNamespace;

	constructor(client: TranslateClient, cache: KVNamespace) {
		this.#client = client;
		this.#cache = cache;
	}

	/**
	 * Translate achievements for the given games.
	 * This method is optimized for translating all achievements for entire games at once.
	 */
	async translateAchievements(achievements: Array<SteamAppAchievement>, locale: LanguageCode) {
		if (achievements.length === 0) return new Map<SteamAppAchievement, string>();

		// Group achievements by app ID for efficient caching and translation
		const achievementsByApp = new Map<number, SteamAppAchievement[]>();
		for (const achievement of achievements) {
			const appId = achievement.app.id;
			const group = achievementsByApp.get(appId) ?? [];
			group.push(achievement);
			achievementsByApp.set(appId, group);
		}

		const results = new Map<SteamAppAchievement, string>();

		// Process each game's achievements
		for (const [appId, appAchievements] of achievementsByApp.entries()) {
			const cacheKey = `translate:${appId}:${locale}`;
			const cachedJson = await this.#cache.get(cacheKey);
			const cachedMap: Record<string, string> = cachedJson ? JSON.parse(cachedJson) : {};

			let dirty = false;

			// Find achievements that need translation
			const toTranslate = appAchievements.filter(
				(achievement) => !cachedMap[achievement.id] && achievement.description,
			);

			// Translate missing achievements
			if (toTranslate.length > 0) {
				try {
					const strings = toTranslate.map((a) => a.description ?? "");
					const response = await this.#client.translateText({
						q: strings,
						target: locale,
					});

					if (!response.data.translations) {
						throw new Error("No translations found in response");
					}

					// Update cache with new translations
					toTranslate.forEach((achievement, idx) => {
						const translation = response.data.translations[idx]?.translatedText;
						if (translation) {
							cachedMap[achievement.id] = translation;
							dirty = true;
						}
					});

					// Save updated cache
					if (dirty) {
						await this.#cache.put(cacheKey, JSON.stringify(cachedMap));
					}
				} catch (error) {
					console.error(`Error translating achievements for app ${appId}:`, error);
				}
			}

			// Add results for this app
			for (const achievement of appAchievements) {
				const translation = cachedMap[achievement.id];
				if (translation) {
					results.set(achievement, translation);
				}
			}
		}

		return results;
	}
}

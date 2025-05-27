import type { KVNamespace } from "@cloudflare/workers-types";
import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import type { LanguageCode } from "../lang";
import type { TranslateClient } from "./client";

export class TranslateRepository {
    #client: TranslateClient;
    #cache: KVNamespace;

    constructor(client: TranslateClient, cache: KVNamespace) {
        this.#client = client;
        this.#cache = cache;
    }

    async translateAchievements(achievements: Array<SteamAppAchievement | SteamUserAchievement>, locale: LanguageCode) {
        const keys = achievements.map((ach) => `translate:${ach.app.id}:${locale}:${ach.id}`);
        const cachedResults = await Promise.all(keys.map((key) => this.#cache.get(key)));
        const needsTranslation = achievements
            // Translate the description
            .map((ach, index) => (cachedResults[index] ? null : [ach.description, index]))
            .filter(Boolean) as [string, number][];

        // This will create a new array with the same length as `achievements`
        const results = [...cachedResults];

        // Translate only if there are descriptions that need translation
        if (needsTranslation.length > 0) {
            const res = await this.#client.translateText({
                q: needsTranslation.map(([description]) => description),
                target: locale,
            });

            if (!res.data.translations) throw new Error("No translations found in response");

            // Cache the translations
            await Promise.all(
                res.data.translations.map((translation, index) => {
                    const achIndex = needsTranslation[index]?.[1];
                    if (achIndex === undefined) throw new Error("Translation index not found");
                    const ach = achievements[achIndex];
                    if (!ach) throw new Error("Achievement not found for translation index");

                    const key = `translate:${ach.app.id}:${locale}:${ach.id}`;
                    return this.#cache.put(key, translation.translatedText, {
                        expirationTtl: 60 * 60 * 24, // Cache for 24 hours
                    });
                }),
            );

            // Merge translations back into the original array using the indices
            const results = [...cachedResults];
            for (const [index, translation] of res.data.translations.map((t) => t.translatedText).entries()) {
                const achIndex = needsTranslation[index]?.[1];
                if (achIndex === undefined) throw new Error("Achievement index not found for translation");
                results[achIndex] = translation;
            }
        }

        // Update the original achievements array with translated description & updated locale
        for (let i = 0; i < achievements.length; i++) {
            const ach = achievements[i];
            if (!ach) continue;

            ach.translation = results[i] ?? null;
        }
    }
}

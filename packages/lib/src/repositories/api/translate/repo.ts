import type { KVNamespace } from "@cloudflare/workers-types";
import type { SteamAppAchievement } from "@models";
import type { LanguageCode } from "../lang";
import type { TranslateClient } from "./client";

export class TranslateRepository {
    #client: TranslateClient;
    #cache: KVNamespace;

    constructor(client: TranslateClient, cache: KVNamespace) {
        this.#client = client;
        this.#cache = cache;
    }

    async translateAchievements(achievements: Array<SteamAppAchievement>, locale: LanguageCode) {
        // Deduplicate achievements by app.id and id
        const uniqueKey = (ach: SteamAppAchievement) => `${ach.app.id}:${ach.id}`;
        const achievementGroups = Map.groupBy(achievements, uniqueKey);
        const uniqueAchievements = new Map<string, SteamAppAchievement>(
            achievementGroups
                .entries()
                // biome-ignore lint/style/noNonNullAssertion: <explanation>
                .map(([key, group]) => [key, group[0]!] as const),
        );

        // Build a map of KV keys for caching (only for unique achievements)
        const keys = new Map<SteamAppAchievement, string>(
            uniqueAchievements.values().map((ach) => [ach, `translate:${ach.app.id}:${locale}:${ach.id}`] as const),
        );

        // Load cached translations (only for unique achievements)
        const cachedEntries = await Promise.all(
            Array.from(uniqueAchievements.values()).map(
                async (a) => [a, await this.#cache.get(keys.get(a) ?? "")] as const,
            ),
        );

        const resultsBuffer = new Map<SteamAppAchievement, string | null>(cachedEntries);

        // Find which achievements need translation
        const needsTranslation = resultsBuffer
            .entries()
            .filter(([a, cached]) => !cached && a.description)
            .map(([a]) => a);

        // Skip if no achievements need translation
        if (needsTranslation.some(Boolean)) {
            // Build a list of strings to translate (deduplicated)
            const stringsToTranslate = needsTranslation.map((a) => a.description ?? "").toArray();

            // Translate, cache, and update achievements
            try {
                const res = await this.#client.translateText({
                    q: stringsToTranslate,
                    target: locale,
                });
                if (!res.data.translations) throw new Error("No translations found in response");

                await Promise.all(
                    needsTranslation.map((ach, index) => {
                        const translation = res.data.translations[index]?.translatedText ?? null;
                        const key = keys.get(ach);
                        if (!key || !translation) throw new Error("Missing key or translation");

                        // Update the cached results
                        resultsBuffer.set(ach, translation);

                        // Cache the translations
                        if (translation) return this.#cache.put(key, translation);
                        return Promise.resolve();
                    }),
                );
            } catch (error) {
                console.error("Error translating achievements:", error);
            }
        }

        // Assign translations directly onto each original achievement
        for (const ach of achievements) {
            const uniqueAch = uniqueAchievements.get(uniqueKey(ach));
            if (!uniqueAch) continue;
            const translation = resultsBuffer.get(uniqueAch) ?? null;
            ach.translation = translation;
        }
    }
}

import type { KVNamespace } from "@cloudflare/workers-types";
import type { SteamAppAchievement } from "../../../";
import type { LanguageCode } from "../lang";
import type { TranslateClient } from "./client";

export class TranslateRepository {
    #client: TranslateClient;
    #cache: KVNamespace;

    constructor(client: TranslateClient, cache: KVNamespace) {
        this.#client = client;
        this.#cache = cache;
    }

    async translateAchievements(ach: Array<SteamAppAchievement>, locale: LanguageCode) {
        const achievements = Array.from(ach);

        // Deduplicate achievements by app.id and id
        const uniqueKey = (ach: SteamAppAchievement) => `${ach.app.id}:${ach.id}`;
        const achievementGroups = Map.groupBy(achievements, uniqueKey);
        const uniqueAchievements = new Map<string, SteamAppAchievement>(
            achievementGroups
                .entries()
                // biome-ignore lint/style/noNonNullAssertion: <explanation>
                .map(([key, group]) => [key, group[0]!] as const),
        );

        // Group by app id for game‐level caching
        const achievementsByApp = new Map<number, SteamAppAchievement[]>();
        for (const uniqueAch of uniqueAchievements.values()) {
            const appId = uniqueAch.app.id;
            const group = achievementsByApp.get(appId) ?? [];
            group.push(uniqueAch);
            achievementsByApp.set(appId, group);
        }

        // Buffer to hold all translations
        const resultsBuffer = new Map<SteamAppAchievement, string | null>();

        // Process each game's achievements in one go
        for (const [appId, appAchievements] of achievementsByApp.entries()) {
            const cacheKey = `translate:${appId}:${locale}`;
            const cachedJson = await this.#cache.get(cacheKey);
            const cachedMap: Record<string, string> = cachedJson ? JSON.parse(cachedJson) : {};

            let dirty = false; // <- only mark true when we add new ones

            // Seed buffer from cache
            for (const achItem of appAchievements) {
                resultsBuffer.set(achItem, cachedMap[achItem.id] ?? null);
            }

            // Find which need translation
            const toTranslate = appAchievements.filter((a) => !resultsBuffer.get(a) && a.description);
            if (toTranslate.length === 0) continue;

            try {
                const strings = toTranslate.map((a) => a.description ?? "");
                const res = await this.#client.translateText({
                    q: strings,
                    target: locale,
                });
                if (!res.data.translations) throw new Error("No translations found");

                // Merge new translations
                toTranslate.forEach((achItem, idx) => {
                    const translation = res.data.translations[idx]?.translatedText;
                    if (translation) {
                        cachedMap[achItem.id] = translation;
                        resultsBuffer.set(achItem, translation);
                        dirty = true;
                    }
                });

                // Update KV with the full map
                if (dirty) await this.#cache.put(cacheKey, JSON.stringify(cachedMap));
            } catch (error) {
                console.error("Error translating achievements:", error);
            }
        }

        const results = new Map<SteamAppAchievement, string>();

        // Assign translations back onto each original achievement
        for (const ach of achievements) {
            const uniqueAch = uniqueAchievements.get(uniqueKey(ach));
            if (!uniqueAch) continue;

            const translation = resultsBuffer.get(uniqueAch) ?? null;
            if (translation) results.set(ach, translation);
        }

        return results;
    }
}

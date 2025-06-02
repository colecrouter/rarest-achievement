/**
 * This endpoint takes in an array of [appid, achievementName] pairs, and ?lang=<languageCode>.
 * It returns a JSON array with the translated achievement descriptions (e.g., {"appid:achievementName": "translated description"}).
 */

import { EnhancedSteamRepository, TranslateRepository, getLanguageByCode } from "@project/lib";
import { error, json } from "@sveltejs/kit";

export const POST = async ({ locals, platform, request }) => {
    const kv = platform?.env.STEAM_CACHE;
    if (!kv) throw new Error("STEAM_CACHE is not available in this environment");
    const translate = new TranslateRepository(locals.translateClient, kv);
    const enhanced = new EnhancedSteamRepository(locals);

    const achievements = new Array<[number, string]>();

    const body = await request.json();
    if (!Array.isArray(body)) error(400, "Invalid request body, expected an array of [appid, achievementName] pairs");

    if (body.length === 0) return json([]);
    for (const item of body) {
        if (!Array.isArray(item) || item.length !== 2)
            error(400, "Invalid item format, expected [appid, achievementName]");
        const [appid, achievementName] = item;
        if (typeof appid !== "number" || typeof achievementName !== "string")
            error(400, "Invalid item format, expected [appid, achievementName]");
        achievements.push([appid, achievementName]);
    }

    const localeStr = new URL(request.url).searchParams.get("lang");
    if (!localeStr) error(400, "Missing 'lang' query parameter");

    // Ensure the locale exists (according to us)
    const locale = getLanguageByCode(localeStr);
    if (!locale) error(400, `Invalid language code: ${localeStr}`);

    // Dedupe app IDs
    const appIds = new Set(achievements.map(([appid]) => appid)).values();

    // Fetch achievements to get English (I guess?) descriptions
    // This has an added bonus of preventing API abuse

    const { data: appsMap } = await enhanced.getApps(appIds, locale.storeCode);
    const { data: achievementsMap } = await enhanced.getGameAchievements(appsMap.values(), locale.storeCode);
    // We're just going to ignore errors for now, I don't think there's any point in failing the whole request

    // Get only the achievements that were requested
    const flattenedAchievements = achievementsMap.values().flatMap((m) => m.values());
    const requestedAchievements = flattenedAchievements.filter((ach) =>
        achievements.some(([appid, name]) => ach.app.id === appid && ach.id === name),
    );

    // Collect the achievements into a payload
    const payload = requestedAchievements.map(({ app, id, description }) => ({ app, id, description })).toArray();

    console.debug(`Translating ${payload.length} achievements for ${locale.storeCode}`);

    // If no achievements, return empty array
    if (payload.length === 0) return json([]);

    const translated = await translate.translateAchievements(payload, locale.storeCode);

    const result = translated
        .entries()
        .map(([ach, translatedDesc]) => [`${ach.app.id}:${ach.id}`, translatedDesc] as const)
        .toArray();
    return json(result);
};

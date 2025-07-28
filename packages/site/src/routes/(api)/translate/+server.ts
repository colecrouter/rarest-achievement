/**
 * This endpoint takes in an array of [appid, achievementName] pairs, and ?lang=<languageCode>.
 * It returns a JSON array with the translated achievement descriptions (e.g., {"appid:achievementName": "translated description"}).
 */

import { type SteamAppAchievement, TranslateRepository, getLanguageByCode } from "@project/lib";
import { error, json } from "@sveltejs/kit";

export const POST = async ({ locals, platform, request }) => {
    const kv = platform?.env.STEAM_CACHE;
    if (!kv) throw new Error("STEAM_CACHE is not available in this environment");
    const translate = new TranslateRepository(locals.translateClient, kv);

    const ids = new Array<[number, string]>();

    const body = await request.json();
    if (!Array.isArray(body)) error(400, "Invalid request body, expected an array of [appid, achievementName] pairs");

    if (body.length === 0) return json([]);
    for (const item of body) {
        if (!Array.isArray(item) || item.length !== 2)
            error(400, "Invalid item format, expected [appid, achievementName]");
        const [appid, achievementName] = item;
        if (typeof appid !== "number" || typeof achievementName !== "string")
            error(400, "Invalid item format, expected [appid, achievementName]");
        ids.push([appid, achievementName]);
    }

    const localeStr = new URL(request.url).searchParams.get("lang");
    if (!localeStr) error(400, "Missing 'lang' query parameter");

    // Ensure the locale exists (according to us)
    const locale = getLanguageByCode(localeStr);
    if (!locale) error(400, `Invalid language code: ${localeStr}`);

    const appIds = new Set(ids.map(([appid]) => appid));
    const achIds = new Set(ids.map(([, achName]) => achName));
    const [requested] = await Promise.all([
        locals.vault.getAppAchievements({
            filters: {
                appId: appIds.values().toArray(),
                achId: achIds.values().toArray(),
            },
            lang: "en",
        }),
        locals.vault.getAppAchievements({
            filters: {
                appId: appIds.values().toArray(),
                achId: achIds.values().toArray(),
            },
            lang: locale.storeCode,
        }),
    ]);

    // Get achievements that are already in the requested language
    const prepared = requested.data
        .filter((ach) => ach.language === locale.storeCode)
        .map((ach) => [`${ach.app.id}:${ach.id}`, ach.description] as const);

    const needTranslation = requested.data.filter((ach) => ach.language !== locale.storeCode);
    console.debug(`Translating ${needTranslation.length} achievements for ${locale.storeCode}`);
    const translated =
        needTranslation.length > 0
            ? await translate.translateAchievements(needTranslation, locale.storeCode)
            : new Map<SteamAppAchievement, string | null>();

    const result = [
        ...prepared,
        ...Array.from(translated.entries()).map(([ach, desc]) => [`${ach.app.id}:${ach.id}`, desc] as const),
    ];

    // const result = translated
    //     .entries()
    //     .map(([ach, translatedDesc]) => [`${ach.app.id}:${ach.id}`, translatedDesc] as const)
    //     .toArray();
    return json(result);
};

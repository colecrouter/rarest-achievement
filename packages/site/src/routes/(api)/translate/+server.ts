/**
 * This endpoint takes in an array of app IDs and ?lang=<languageCode>.
 * It returns a JSON array with the translated achievement descriptions for ALL achievements in those games.
 * Format: {"appid:achievementName": "translated description"}
 */

import { TranslateRepository, getLanguageByCode } from "@project/lib";
import { error, json } from "@sveltejs/kit";

export const POST = async ({ locals, platform, request }) => {
    const kv = platform?.env.STEAM_CACHE;
    if (!kv) throw new Error("STEAM_CACHE is not available in this environment");
    const translate = new TranslateRepository(locals.translateClient, kv);

    const body = await request.json();
    if (!Array.isArray(body)) error(400, "Invalid request body, expected an array of app IDs");

    if (body.length === 0) return json({});

    const appIds: number[] = [];
    for (const item of body) {
        if (typeof item !== "number") error(400, "Invalid item format, expected numeric app ID");
        appIds.push(item);
    }

    const localeStr = new URL(request.url).searchParams.get("lang");
    if (!localeStr) error(400, "Missing 'lang' query parameter");

    // Ensure the locale exists (according to us)
    const locale = getLanguageByCode(localeStr);
    if (!locale) error(400, `Invalid language code: ${localeStr}`);

    // Fetch English achievements for translation
    const enResult = await locals.vault.appAchievements.compose().withLanguage("en").withAppIds(appIds).build();

    if (!enResult.hasData()) {
        console.warn("No English achievements found for translation");
        return json({});
    }

    console.debug(`Translating ${enResult.data.length} achievements for ${locale.storeCode}`);
    const translated = await translate.translateAchievements(enResult.data, locale.storeCode);

    // Convert to the expected format
    const result: Record<string, string> = {};
    for (const [achievement, translatedText] of translated.entries()) {
        result[`${achievement.app.id}:${achievement.id}`] = translatedText;
    }

    return json(result);
};

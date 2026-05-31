import { getLanguageByCode, type LanguageCode, TranslateClient, TranslateRepository } from "@project/lib";
import { z } from "zod";
import { getRequestEvent, query } from "$app/server";
import { env } from "$env/dynamic/private";

const translationRequestSchema = z.object({
	appId: z.number().int().positive(),
	achievementId: z.string().min(1),
	lang: z.custom<LanguageCode>((lang) => typeof lang === "string" && getLanguageByCode(lang) !== undefined),
});

export const getAchievementTranslation = query.batch(translationRequestSchema, async (requests) => {
	const { locals, platform } = getRequestEvent();
	const cache = platform?.env.STEAM_CACHE;
	if (!cache) throw new Error("STEAM_CACHE is not available in this environment");

	if (requests.length === 0) return () => null;

	const appIds = [...new Set(requests.map((request) => request.appId))];
	const enResult = await locals.vault.appAchievements.compose().withLanguage("en").withAppIds(appIds).build();

	if (!enResult.hasData()) return () => null;

	const translate = new TranslateRepository(new TranslateClient(env.GOOGLE_API_KEY), cache);
	const translatedByKey = new Map<string, string>();

	for (const lang of new Set(requests.map((request) => request.lang))) {
		const translated = await translate.translateAchievements(enResult.data, lang);
		for (const [achievement, translatedText] of translated.entries()) {
			translatedByKey.set(`${lang}:${achievement.app.id}:${achievement.id}`, translatedText);
		}
	}

	return (request) => translatedByKey.get(`${request.lang}:${request.appId}:${request.achievementId}`) ?? null;
});

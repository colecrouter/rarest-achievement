import { type APILanguageCode, type LanguageCode, getLanguageByCode } from "../../src/lang";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { achievementsStats, estimatedPlayers } from "../../src/repositories/sqlite/schema";
import { makeAppData } from "./appData";
import { insertAchievementMeta, insertApp } from "./dbHelpers";

/**
 * Seed an app row (EN) and an estimated players row for convenience in achievement tests.
 */
export async function seedAppWithPlayers(db: ProjectDB, appId: number, name = "Test App", players = 1000) {
	await insertApp(db, { id: appId, lang: "english", data: makeAppData(appId, name) });
	await db.insert(estimatedPlayers).values({
		app_id: appId,
		estimated_players: players,
		updated_at: new Date(),
	});
}

/**
 * Seed achievement global stats (percentages) for an app.
 */
export async function seedStats(db: ProjectDB, appId: number, items: Array<{ ach: string; percent: number }>) {
	for (const it of items) {
		await db.insert(achievementsStats).values({
			app_id: appId,
			ach_id: it.ach,
			percent: it.percent,
			updated_at: new Date(),
		});
	}
}

/**
 * Seed achievement metadata for an app in a specific API language.
 */
export async function seedMeta(
	db: ProjectDB,
	appId: number,
	lang: APILanguageCode,
	items: Array<{
		ach: string;
		display: string;
		description?: string;
		defaultValue?: number;
		hidden?: number;
		icon?: string;
		icongray?: string;
	}>,
) {
	for (const it of items) {
		await insertAchievementMeta(db, {
			app_id: appId,
			ach_id: it.ach,
			display_name: it.display,
			default_value: it.defaultValue ?? 0,
			description: it.description,
			icon: it.icon ?? "icon.png",
			icon_gray: it.icongray ?? "gray.png",
			hidden: it.hidden ?? 0,
			lang,
		});
	}
}

/**
 * Wrapper: insert app using store language code (e.g., 'en', 'fr').
 * Maps to API language code for DB storage.
 */
export async function insertAppByCode(db: ProjectDB, params: { id: number; langCode: LanguageCode; name: string }) {
	const entry = getLanguageByCode(params.langCode);
	if (!entry) throw new Error(`Unknown language code: ${params.langCode}`);
	await insertApp(db, { id: params.id, lang: entry.apiCode, data: makeAppData(params.id, params.name) });
}

/**
 * Wrapper: seed meta using store language code (e.g., 'en', 'fr').
 */
export async function seedMetaByCode(
	db: ProjectDB,
	appId: number,
	langCode: LanguageCode,
	items: Parameters<typeof seedMeta>[3],
) {
	const entry = getLanguageByCode(langCode);
	if (!entry) throw new Error(`Unknown language code: ${langCode}`);
	await seedMeta(db, appId, entry.apiCode, items);
}

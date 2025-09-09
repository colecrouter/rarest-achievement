import {
	type APILanguageCode,
	type SteamAchievementRawGlobalStats,
	type SteamAchievementRawMeta,
	type SteamApp,
	SteamAppAchievement,
} from "../../src";

export function makeAchievementMeta(
	name: string,
	displayName: string,
	overrides: Partial<SteamAchievementRawMeta> = {},
): SteamAchievementRawMeta {
	return {
		name,
		displayName,
		description: "Test description",
		defaultvalue: 0,
		hidden: 0,
		icon: "icon.png",
		icongray: "gray.png",
		...overrides,
	};
}

export function makeGlobalStats(
	name: string,
	percent: number,
	overrides: Partial<SteamAchievementRawGlobalStats> = {},
): SteamAchievementRawGlobalStats {
	return {
		name,
		percent,
		...overrides,
	};
}

/**
 * Creates a mock SteamAppAchievement instance.
 * @param app The SteamApp instance for this achievement
 * @param achievementName The achievement name
 * @param displayName The display name
 * @param percent The global percentage
 * @param metaOverrides Any overrides for the achievement meta
 * @param globalOverrides Any overrides for the global stats
 * @param lang The API language code (default: "english")
 * @returns A new SteamAppAchievement instance
 */
export function makeAppAchievement(
	app: SteamApp,
	achievementName = `ACH_${Math.floor(Math.random() * 10000)}`,
	displayName = `Achievement ${achievementName}`,
	percent = Math.random() * 100,
	metaOverrides: Partial<SteamAchievementRawMeta> = {},
	globalOverrides: Partial<SteamAchievementRawGlobalStats> = {},
	lang: APILanguageCode = "english",
) {
	const meta = makeAchievementMeta(achievementName, displayName, metaOverrides);
	const globalStats = makeGlobalStats(achievementName, percent, globalOverrides);

	return new SteamAppAchievement({ app, meta, globalStats, lang });
}

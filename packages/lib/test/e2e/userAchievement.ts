import {
	type SteamAchievementRawGlobalStats,
	type SteamAchievementRawMeta,
	type SteamApp,
	type SteamUser,
	SteamUserAchievement,
	type SteamUserAchievementRawStats,
} from "../../src";
import { makeAchievementMeta, makeGlobalStats } from "./appAchievement";

/**
 * Create user achievement stats fixture for testing
 */
export function makeUserAchievementStats(
	apiname: string,
	achieved: number = 0,
	unlocktime: number | undefined = 0,
): SteamUserAchievementRawStats {
	return {
		apiname,
		achieved,
		unlocktime,
	};
}

/**
 * Creates a mock SteamUserAchievement instance.
 * @param app The SteamApp instance for this achievement
 * @param user The SteamUser instance for this achievement
 * @param achievementName The achievement name
 * @param displayName The display name
 * @param percent The global percentage
 * @param userStats The user achievement stats (null if not unlocked)
 * @param metaOverrides Any overrides for the achievement meta
 * @param globalOverrides Any overrides for the global stats
 * @param lang The API language code (default: "english")
 * @returns A new SteamUserAchievement instance
 */
export function makeUserAchievement(
	app: SteamApp,
	user: SteamUser,
	achievementName = `ACH_${Math.floor(Math.random() * 10000)}`,
	displayName = `Achievement ${achievementName}`,
	percent = Math.random() * 100,
	userOverrides: Partial<SteamUserAchievementRawStats> = {},
	metaOverrides: Partial<SteamAchievementRawMeta> = {},
	globalOverrides: Partial<SteamAchievementRawGlobalStats> = {},
) {
	const lang = app.language.apiCode;
	const meta = makeAchievementMeta(achievementName, displayName, metaOverrides);
	const globalStats = makeGlobalStats(achievementName, percent, globalOverrides);

	// Create user stats - if no overrides provided, defaults to locked
	const userStats =
		Object.keys(userOverrides).length > 0
			? makeUserAchievementStats(achievementName, userOverrides.achieved ?? 0, userOverrides.unlocktime ?? 0)
			: null; // No user data means not unlocked

	return new SteamUserAchievement({
		app,
		meta,
		globalStats,
		lang,
		user,
		userStats,
	});
}

/**
 * Creates a locked achievement (user has not unlocked it)
 */
export function makeLockedUserAchievement(
	app: SteamApp,
	user: SteamUser,
	achievementName = `ACH_${Math.floor(Math.random() * 10000)}`,
	displayName = `Achievement ${achievementName}`,
	percent = Math.random() * 100,
	metaOverrides: Partial<SteamAchievementRawMeta> = {},
	globalOverrides: Partial<SteamAchievementRawGlobalStats> = {},
) {
	return makeUserAchievement(app, user, achievementName, displayName, percent, {}, metaOverrides, globalOverrides);
}

/**
 * Creates an unlocked achievement (user has unlocked it)
 */
export function makeUnlockedUserAchievement(
	app: SteamApp,
	user: SteamUser,
	achievementName = `ACH_${Math.floor(Math.random() * 10000)}`,
	displayName = `Achievement ${achievementName}`,
	percent = Math.random() * 100,
	unlockTime: number = Math.floor(Date.now() / 1000),
	metaOverrides: Partial<SteamAchievementRawMeta> = {},
	globalOverrides: Partial<SteamAchievementRawGlobalStats> = {},
) {
	return makeUserAchievement(
		app,
		user,
		achievementName,
		displayName,
		percent,
		{ achieved: 1, unlocktime: unlockTime },
		metaOverrides,
		globalOverrides,
	);
}

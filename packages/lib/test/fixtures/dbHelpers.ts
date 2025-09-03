import type { APILanguageCode } from "../../src/lang";
import type { SteamAppRaw, SteamUserRaw } from "../../src/models";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import {
	achievementsMeta,
	apps,
	friends,
	ownedGames,
	userAchievements,
	users,
} from "../../src/repositories/sqlite/schema";

/**
 * Insert an app record into the database
 */
export async function insertApp(
	db: ProjectDB,
	{ id, lang, data }: { id: number; lang: APILanguageCode; data: SteamAppRaw },
) {
	await db.insert(apps).values({
		id,
		lang,
		data,
		updated_at: new Date(),
	});
}

/**
 * Insert a user record into the database
 */
export async function insertUser(db: ProjectDB, { id, data }: { id: string; data: SteamUserRaw }) {
	await db.insert(users).values({
		id,
		data,
		updated_at: new Date(),
	});
}

/**
 * Insert achievement metadata into the database
 */
export async function insertAchievementMeta(
	db: ProjectDB,
	{
		app_id,
		ach_id,
		display_name,
		default_value,
		description,
		icon,
		icon_gray,
		hidden,
		lang,
	}: {
		app_id: number;
		ach_id: string;
		display_name: string;
		default_value: number;
		description?: string;
		icon: string;
		icon_gray: string;
		hidden: number;
		lang: APILanguageCode;
	},
) {
	await db.insert(achievementsMeta).values({
		app_id,
		ach_id,
		display_name,
		default_value,
		description: description || "",
		icon,
		icon_gray,
		hidden,
		lang,
	});
}

/**
 * Truncate all tables for clean test setup
 */
export async function truncateAll(db: ProjectDB) {
	// Note: Since this is SQLite, we use DELETE instead of TRUNCATE
	try {
		await db.delete(achievementsMeta);
		await db.delete(apps);
	} catch (error) {
		// Ignore errors if tables don't exist yet
		console.warn("Error truncating tables:", error);
	}
}

/**
 * Insert a friendship row
 */
export async function insertFriend(
	db: ProjectDB,
	{
		user_id,
		friend_id,
		friend_since,
	}: {
		user_id: string;
		friend_id: string;
		friend_since: Date;
	},
) {
	await db.insert(friends).values({
		user_id,
		friend_id,
		friend_since,
		updated_at: new Date(),
	});
}

/**
 * Insert an owned game row
 */
export async function insertOwnedGame(
	db: ProjectDB,
	{
		user_id,
		app_id,
		playtime_2w_minutes,
		playtime_total_minutes,
		last_played_at,
	}: {
		user_id: string;
		app_id: number;
		playtime_2w_minutes?: number | null;
		playtime_total_minutes?: number | null;
		last_played_at?: Date | null;
	},
) {
	await db.insert(ownedGames).values({
		user_id,
		app_id,
		playtime_2w_minutes: playtime_2w_minutes ?? null,
		playtime_total_minutes: playtime_total_minutes ?? null,
		last_played_at: last_played_at ?? null,
	});
}

/**
 * Insert a user achievement row
 */
export async function insertUserAchievement(
	db: ProjectDB,
	{
		user_id,
		app_id,
		ach_id,
		unlocked_at,
	}: {
		user_id: string;
		app_id: number;
		ach_id: string;
		unlocked_at?: Date | null;
	},
) {
	await db.insert(userAchievements).values({
		user_id,
		app_id,
		ach_id,
		unlocked_at: unlocked_at ?? null,
		updated_at: new Date(),
	});
}

import {
	achievementsMeta,
	achievementsStats,
	apps,
	friends,
	getLanguageByAPICode,
	ownedGames,
	userAchievements,
	users,
} from "@project/lib";
import { and, asc, eq, exists, lt, not } from "drizzle-orm";
import type { CronCtx } from ".";

const REFRESH_STALE_APPS_COUNT = 100;

export const refreshStaleApps = async (ctx: CronCtx) => {
	const ONE_DAY_AGO = new Date();
	ONE_DAY_AGO.setDate(ONE_DAY_AGO.getDate() - 1);

	// Get the oldest apps that are older than 1 day
	const keys = await ctx.db
		.select({ id: apps.id, lang: apps.lang })
		.from(apps)
		.where(lt(apps.updated_at, ONE_DAY_AGO))
		.orderBy(asc(apps.updated_at))
		.limit(REFRESH_STALE_APPS_COUNT);

	if (keys.length === 0) return;

	for (const pair of keys) {
		// Delete ALL language variants for this app - much cleaner and avoids consistency issues
		await ctx.db.batch([
			// Delete all languages for this app
			ctx.db.delete(apps).where(eq(apps.id, pair.id)),
			ctx.db.delete(achievementsMeta).where(eq(achievementsMeta.app_id, pair.id)), // Delete all language metadata
			ctx.db.delete(achievementsStats).where(eq(achievementsStats.app_id, pair.id)), // Delete stats (language-independent)
		]);

		const lang = getLanguageByAPICode(pair.lang);
		if (!lang) throw new Error(`Unsupported language code: ${pair.lang}`);

		// Fetch the latest app data from the API
		await ctx.service.getAppsWithFullData({
			appIds: [pair.id],
			lang: lang.storeCode,
		});
	}
};

// Single-pass cleanup:
// 1. Delete stale rows from user-scoped tables (achievements, owned games, friends) using their own updated_at / friend_since heuristics.
// 2. Delete users that no longer have any related data in those tables.
// NOTE: user_scores retained (no FK) so orphan scores may remain intentionally for historical purposes.
const STALE_ACHIEVEMENT_DAYS = 7;
const STALE_OWNED_GAMES_DAYS = 14;
const STALE_FRIENDS_DAYS = 14; // using updated_at; friend_since is immutable join time

export const cleanupUserData = async (ctx: CronCtx) => {
	const now = ctx.now ?? new Date();
	const achCutoff = new Date(now);
	achCutoff.setDate(achCutoff.getDate() - STALE_ACHIEVEMENT_DAYS);
	const ownedCutoff = new Date(now);
	ownedCutoff.setDate(ownedCutoff.getDate() - STALE_OWNED_GAMES_DAYS);
	const friendCutoff = new Date(now);
	friendCutoff.setDate(friendCutoff.getDate() - STALE_FRIENDS_DAYS);

	// 1. Delete stale user achievements
	await ctx.db.delete(userAchievements).where(lt(userAchievements.updated_at, achCutoff));

	// 2. Delete stale owned games
	await ctx.db.delete(ownedGames).where(lt(ownedGames.last_played_at, ownedCutoff));

	// 3. Delete stale friends (by updated_at)
	await ctx.db.delete(friends).where(lt(friends.updated_at, friendCutoff));

	// 4. Delete users that have no remaining achievements, owned games, or friend relationships (either side)
	// Use NOT EXISTS subqueries to ensure there is truly no related data.
	// (Drizzle doesn't have a high-level helper for complex multi NOT EXISTS -> compose manually.)
	await ctx.db
		.delete(users)
		.where(
			and(
				not(exists(ctx.db.select().from(userAchievements).where(eq(userAchievements.user_id, users.id)))),
				not(exists(ctx.db.select().from(ownedGames).where(eq(ownedGames.user_id, users.id)))),
				not(exists(ctx.db.select().from(friends).where(eq(friends.user_id, users.id)))),
				not(exists(ctx.db.select().from(friends).where(eq(friends.friend_id, users.id)))),
			),
		);
};

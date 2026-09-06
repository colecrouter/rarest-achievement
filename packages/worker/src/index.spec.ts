import { ownedGames, type ProjectDB } from "@project/lib";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import type { CronCtx } from "./jobs";
import { cleanupUserData } from "./jobs/cleanup";

describe("cleanupUserData", () => {
	it("uses cache freshness instead of gameplay activity when pruning owned games", async () => {
		const sqlite = new Database(":memory:");
		sqlite.exec(`
			CREATE TABLE users (
				user_id TEXT PRIMARY KEY NOT NULL,
				data TEXT NOT NULL,
				updated_at INTEGER NOT NULL
			);
			CREATE TABLE user_achievements_stats (
				user_id TEXT NOT NULL,
				app_id INTEGER NOT NULL,
				ach_id TEXT NOT NULL,
				unlocked_at INTEGER,
				updated_at INTEGER NOT NULL,
				PRIMARY KEY (user_id, app_id, ach_id)
			);
			CREATE TABLE owned_games (
				user_id TEXT NOT NULL,
				app_id INTEGER NOT NULL,
				playtime_last_two_weeks INTEGER,
				playtime_total INTEGER,
				last_played_at INTEGER,
				updated_at INTEGER,
				PRIMARY KEY (user_id, app_id)
			);
			CREATE TABLE friends (
				user_id TEXT NOT NULL,
				friend_id TEXT NOT NULL,
				friend_since INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				PRIMARY KEY (user_id, friend_id)
			);
		`);

		const db = drizzle(sqlite) as unknown as ProjectDB;
		const now = new Date("2026-09-06T00:00:00Z");
		const oldGameplay = new Date("2014-08-24T00:00:00Z");
		const freshCache = new Date("2026-09-05T00:00:00Z");
		const staleCache = new Date("2026-08-01T00:00:00Z");

		await db.insert(ownedGames).values([
			{
				user_id: "user-1",
				app_id: 10,
				last_played_at: oldGameplay,
				updated_at: freshCache,
			},
			{
				user_id: "user-1",
				app_id: 20,
				last_played_at: now,
				updated_at: staleCache,
			},
		]);

		await cleanupUserData({ db, now } as CronCtx);

		const remaining = await db.select({ appId: ownedGames.app_id }).from(ownedGames);
		expect(remaining).toEqual([{ appId: 10 }]);
	});
});

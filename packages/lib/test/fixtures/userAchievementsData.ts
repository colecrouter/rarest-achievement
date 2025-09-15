import type { GetPlayerAchievementsResponse } from "../../src/repositories/api/steampowered/playerAchievement";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";
import { insertUserAchievement } from "./dbHelpers";

/**
 * Build a typed GetPlayerAchievementsResponse payload for a given user/app.
 * Mirrors the shape returned by Steam's GetPlayerAchievements.
 */
export function makePlayerAchievementsPayload(opts: {
	userId: string;
	appId: number;
	items: Array<{ ach: string; achieved?: 0 | 1; unlock?: Date | null }>;
}): GetPlayerAchievementsResponse<undefined> {
	return {
		playerstats: {
			steamID: opts.userId,
			gameName: `App ${opts.appId}`,
			achievements: opts.items.map((i) => ({
				apiname: i.ach,
				achieved: i.achieved ?? 0,
				unlocktime: i.unlock ? Math.floor(i.unlock.getTime() / 1000) : 0,
			})),
		},
	} as GetPlayerAchievementsResponse<undefined>;
}

/**
 * Convenience seeding for multiple user achievement rows.
 */
export async function seedUserAchievements(
	db: ProjectDB,
	userId: string,
	appId: number,
	items: Array<{ ach: string; unlocked?: Date | null }>,
) {
	for (const it of items) {
		await insertUserAchievement(db, {
			user_id: userId,
			app_id: appId,
			ach_id: it.ach,
			unlocked_at: it.unlocked ?? null,
		});
	}
}

import { AttemptStatus, userScores, users } from "@project/lib";
import { asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { CronCtx } from ".";

const TTL_DAYS = 7;

/**
 * Refresh rare_count for exactly one user whose score is missing or stale.
 * Matches the style of cleanup functions: explicit params, no globals/env.
 */
export async function refreshRareCount(ctx: CronCtx) {
    const threshold = new Date(Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000);

    // Select exactly one user needing refresh (no score or stale score)
    const candidates = await ctx.db
        .select({ userId: users.id })
        .from(users)
        .leftJoin(userScores, eq(userScores.user_id, users.id))
        .where(or(isNull(userScores.updated_at), lt(userScores.updated_at, threshold)))
        // Order NULL first, then oldest first
        .orderBy(asc(sql`COALESCE(${userScores.updated_at}, ${new Date(0)})`))
        .limit(1);

    const userId = candidates[0]?.userId;
    if (!userId) return;

    // Compute rare_count via COUNT-only path, English language
    const attempt = await ctx.service.userAchievements
        .compose()
        .withUserIds(userId)
        .withUnlockedStatus(true)
        .withRarityThreshold(0.1)
        .withLanguage("en")
        .count();

    // Upsert only on full success
    if (attempt.status === AttemptStatus.Ok && attempt.data !== null) {
        const rareCount = attempt.data;
        await ctx.db
            .insert(userScores)
            .values({
                user_id: userId,
                rare_count: rareCount,
                updated_at: new Date(),
            })
            .onConflictDoUpdate({
                target: userScores.user_id,
                set: {
                    rare_count: rareCount,
                    updated_at: new Date(),
                },
            });
        return;
    }

    throw new Error(`Failed to refresh rare_count for user ${userId}`);
}

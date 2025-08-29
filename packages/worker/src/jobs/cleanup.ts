import { achievementsMeta, achievementsStats, apps, getLanguageByAPICode, userAchievements, users } from "@project/lib";
import { asc, eq, lt } from "drizzle-orm";
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
            ctx.db
                .delete(apps)
                .where(eq(apps.id, pair.id)),
            ctx.db
                .delete(achievementsMeta)
                .where(eq(achievementsMeta.app_id, pair.id)), // Delete all language metadata
            ctx.db
                .delete(achievementsStats)
                .where(eq(achievementsStats.app_id, pair.id)), // Delete stats (language-independent)
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

export const deleteStaleUsers = async (ctx: CronCtx) => {
    const ONE_DAY_AGO = new Date();
    ONE_DAY_AGO.setDate(ONE_DAY_AGO.getDate() - 1);

    // Get the oldest users that are older than 1 day
    const keys = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(lt(users.updated_at, ONE_DAY_AGO))
        .orderBy(asc(users.updated_at));

    if (keys.length === 0) return;

    // This isn't exactly scalable, but it works for now
    // It also doesn't violate foreign key constraints, because achievements could be updated independently of the user (in the future maybe)
    for (const key of keys) {
        // Delete the stale user data
        await ctx.db.batch([
            ctx.db.delete(users).where(eq(users.id, key.id)),
            ctx.db.delete(userAchievements).where(eq(userAchievements.user_id, key.id)),
        ]);
    }
};

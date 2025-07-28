import { AchievementURLParameterParser } from "$lib/SortManager/AchievementSortManager.js";
import { getLocale } from "$lib/paraglide/runtime.js";
import { userScores } from "@project/lib";

export const load = async ({ url, locals, parent }) => {
    // Need to load the locale synchronously
    const locale = getLocale();

    const { topThree, user } = await parent();

    const achievements = (async () => {
        await topThree;

        const paramParser = new AchievementURLParameterParser({
            method: "rarity_pct",
            direction: "asc",
        });

        const config = paramParser.parseFromURL(url);

        const achievementsForUserQuery = locals.vault.userAchievements
            .compose()
            .withLanguage(locale)
            .withUserIds([user.id])
            .withUnlockedStatus(true);

        if (config.search) achievementsForUserQuery.withSearch(config.search);

        return achievementsForUserQuery.build({ limit: 30, sort: config });
    })();

    // TODO: refactor score calculation
    // TODO once migrated to workers from pages, move this into a ctx.waitUntil
    achievements.then(() =>
        locals.vault.userAchievements
            .compose()
            .withUserIds(user.id)
            .withUnlockedStatus(true)
            .withRarityThreshold(0.1)
            .build()
            .then((a) =>
                locals.steamCacheDB
                    .insert(userScores)
                    .values({
                        rare_count: a.data.length,
                        user_id: user.id,
                    })
                    .onConflictDoUpdate({
                        target: userScores.user_id,
                        set: {
                            rare_count: a.data.length,
                            updated_at: new Date(),
                        },
                    }),
            ),
    );

    return {
        achievements,
    };
};

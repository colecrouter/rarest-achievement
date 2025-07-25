import { AchievementURLParameterParser } from "$lib/SortManager/AchievementSortManager.js";
import { getLocale } from "$lib/paraglide/runtime.js";
import { userScores } from "@project/lib";
import { error } from "@sveltejs/kit";

export const load = async ({ url, params, locals }) => {
    // Need to load the locale synchronously
    const locale = getLocale();

    const { id } = params;
    // I've avoided calling await parent() here because it causes unnecessary parent reruns
    const { data } = await locals.vault.users.compose().withUserIds([id]).build({ limit: 1 });
    const user = data.find((u) => u.id === id);
    if (!user) error(404, "User not found");

    const achievements = (async () => {
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

        return achievementsForUserQuery.build({ limit: 32, sort: config });
    })();

    // TODO: refactor score calculation
    // TODO once migrated to workers from pages, move this into a ctx.waitUntil
    await locals.vault.userAchievements
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
        );

    return {
        user,
        achievements,
    };
};

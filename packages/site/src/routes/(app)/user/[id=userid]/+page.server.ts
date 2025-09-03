import { AchievementURLParameterParser } from "$lib/SortManager/AchievementSortManager.js";
import { getLocale } from "$lib/paraglide/runtime.js";

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

        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const achievementsForUserQuery = locals.vault.userAchievements
            .compose()
            .withLanguage(locale)
            .withUserIds([user.id])
            .withCutoff(oneDayAgo)
            .withUnlockedStatus(true);

        if (config.search) achievementsForUserQuery.withSearch(config.search);

        return achievementsForUserQuery.build({ limit: 30, sort: config });
    })();

    return {
        achievements,
    };
};

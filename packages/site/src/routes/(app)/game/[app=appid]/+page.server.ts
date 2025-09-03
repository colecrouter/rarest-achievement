import { getLocale } from "$lib/paraglide/runtime.js";

export const load = async ({ parent, locals }) => {
    const { app } = await parent();

    const locale = getLocale();

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // If the user is logged in, fetch user achievements instead of global achievements
    const achievements = locals.steamUser
        ? await locals.vault.userAchievements
              .compose()
              .withCutoff(oneDayAgo)
              .withLanguage(locale)
              .withAppIds(app.id)
              .withUserIds([locals.steamUser.id])
              .build()
        : await locals.vault.appAchievements.compose().withLanguage(locale).withAppIds(app.id).build();

    const friendsWithAchievement = (async () => {
        if (!locals.steamUser) return null;

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Fetch achievements for each friend who owns the game
        const result = await locals.vault.userAchievements
            .compose()
            .withLanguage(locale)
            .withAppIds(app.id)
            .withFriendsOf(locals.steamUser.id)
            .build({ limit: 10000 }); // TODO

        const filteredPrivateOrBot = result.map((d) =>
            d
                .filter((item) => {
                    const u = item.user;
                    // If there is no user attached (fallback from non-owner view), include the item.
                    if (!u) return true;
                    return (
                        u.lastLoggedIn &&
                        u.lastLoggedIn >= oneMonthAgo &&
                        u.created &&
                        u.created < oneYearAgo &&
                        !u.private
                    );
                })
                .sort((a, b) => {
                    // Sort by last logged in first (safe when user may be undefined)
                    const aLast = a.user?.lastLoggedIn ?? new Date(0);
                    const bLast = b.user?.lastLoggedIn ?? new Date(0);
                    return bLast.getTime() - aLast.getTime();
                }),
        );

        // Group only items that have an associated user (skip fallback/global items)
        // Use a type guard so TypeScript understands user is present after filtering.
        const usersWith = filteredPrivateOrBot.data.filter(
            (
                u,
            ): u is (typeof filteredPrivateOrBot.data)[number] & {
                user: NonNullable<(typeof filteredPrivateOrBot.data)[number]["user"]>;
            } => !!u.user,
        );
        const grouped = Map.groupBy(usersWith, (u) => u.user.id);
        const usersWhoHaventPlayed = new Set(
            grouped
                .entries()
                // We could try filtering by playtime, but it's not reliable for my acct due to API key belonging to me
                // In practice, either or both is *probably* fine
                .filter(([, ach]) => ach.every((a) => !a.unlocked))
                .map(([userId]) => userId),
        );

        return filteredPrivateOrBot.map((achievements) =>
            // Keep items without a user (fallback) and exclude users who haven't played
            achievements.filter((a) => !(a.user && usersWhoHaventPlayed.has(a.user.id))),
        );
    })();

    return {
        achievements,
        friendsWithAchievement,
    };
};

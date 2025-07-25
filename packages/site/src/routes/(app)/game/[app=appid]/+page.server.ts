import { getLocale } from "$lib/paraglide/runtime.js";
import {
    type APILanguageCode,
    Attempt,
    type SteamAppAchievement,
    type SteamUser,
    type SteamUserAchievement,
    getLanguageByCode,
} from "@project/lib";

export const load = async ({ parent, locals }) => {
    const { app } = await parent();

    const locale = getLocale();

    // If the user is logged in, fetch user achievements instead of global achievements
    const achievements = locals.steamUser
        ? await locals.vault.userAchievements
              .compose()
              .withLanguage(locale)
              .withAppIds([app.id])
              .withUserIds([locals.steamUser.id])
              .build()
        : await locals.vault.appAchievements.compose().withLanguage(locale).withAppIds([app.id]).build();

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
            .withAppIds([app.id])
            .withFriendsOf(locals.steamUser.id)
            .build({ limit: 10000 }); // TODO

        const filteredPrivateOrBot = result.map((d) =>
            d
                .filter(
                    (d) =>
                        d.user.lastLoggedIn &&
                        d.user.lastLoggedIn >= oneMonthAgo &&
                        d.user.created &&
                        d.user.created < oneYearAgo &&
                        !d.user.private,
                )
                .sort(
                    (a, b) =>
                        // Sort by last logged in first
                        (b.user.lastLoggedIn ?? new Date(0)).getTime() - (a.user.lastLoggedIn ?? new Date(0)).getTime(),
                ),
        );

        const grouped = Map.groupBy(filteredPrivateOrBot.data, (u) => u.user.id);
        const usersWhoHaventPlayed = new Set(
            grouped
                .entries()
                // We could try filtering by playtime, but it's not reliable for my acct due to API key belonging to me
                // In practice, either or both is *probably* fine
                .filter(([, ach]) => ach.every((a) => !a.unlocked))
                .map(([userId]) => userId),
        );
        console.log(usersWhoHaventPlayed);

        return filteredPrivateOrBot.map((achievements) =>
            achievements.filter((a) => !usersWhoHaventPlayed.has(a.user.id)),
        );
    })();

    return {
        achievements,
        friendsWithAchievement,
    };
};

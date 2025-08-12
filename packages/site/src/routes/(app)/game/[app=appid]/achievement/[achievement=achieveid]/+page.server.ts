import { GOOGLE_API_KEY } from "$env/static/private";
import { getLocale } from "$lib/paraglide/runtime.js";
import {
    Attempt,
    type SteamAppAchievement,
    SteamCommunityRepo,
    type SteamOwnedGame,
    YouTubeRepository,
} from "@project/lib";

export const load = async ({ parent, url, locals, platform }) => {
    const locale = getLocale();

    const data = await parent();
    const { app, loggedIn, achievement } = data;
    if (!platform) throw new Error("No platform found");

    const steamComRepo = new SteamCommunityRepo(platform.env.STEAM_CACHE, locals.steamCommunityClient);
    const youtubeRepo = new YouTubeRepository(GOOGLE_API_KEY, platform.env.STEAM_CACHE, platform.env.AI);

    const gameAchievements = await locals.vault.appAchievements
        .compose()
        .withLanguage(locale)
        .withAppIds([app.id])
        .build();

    const friendsWithAchievement = (async () => {
        if (!loggedIn) return null;
        if (url.searchParams.get("tab") !== "friends") return null;

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Fetch achievements for each friend who owns the game
        const result = await locals.vault.userAchievements
            .compose()
            .withLanguage(locale)
            .withAppIds([app.id])
            .withFriendsOf(loggedIn.id)
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

        return filteredPrivateOrBot;
    })();

    const articles = (async () => {
        if (url.searchParams.get("tab") !== "articles") return null;

        const { data: articles, error: err1 } = await steamComRepo.searchGuides(achievement, locale);
        const { data: videos, error: err2 } = await youtubeRepo.searchGuides(achievement, locale);

        return Attempt.from(
            {
                articles: articles?.slice(0, 3) ?? [],
                videos: videos?.slice(0, 3) ?? [],
            },
            err1 ?? err2,
        );
    })();

    return {
        gameAchievements,
        friendsWithAchievement,
        articles,
    };
};

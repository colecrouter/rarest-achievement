import { GOOGLE_API_KEY } from "$env/static/private";
import { EnhancedSteamRepository, Errable, SteamCommunityRepo, YouTubeRepository } from "@project/lib";

export const load = async ({ parent, url, locals, platform }) => {
    const data = await parent();
    const { app, loggedIn, achievement } = data;
    if (!platform) throw new Error("No platform found");

    const steamRepo = new EnhancedSteamRepository(locals);
    const steamComRepo = new SteamCommunityRepo(platform.env.STEAM_CACHE);
    const youtubeRepo = new YouTubeRepository(GOOGLE_API_KEY, platform.env.STEAM_CACHE);

    const game = await steamRepo.getGameAchievements([app]);
    const gameAchievements = game.data.get(app.id);

    const friendsWithAchievement = (async () => {
        if (!loggedIn) return new Errable(null, null);
        if (url.searchParams.get("tab") !== "friends") return new Errable(null, null);

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Fetch friends who own the game
        const { data: friends, error: err1 } = await steamRepo.getFriends([loggedIn]);
        const filteredFriends = [...friends.values()]
            .flat()
            .filter((f) => {
                const isPrivate = f.private;
                const isOldEnough = f.created && f.created < oneMonthAgo;
                const isDead = f.lastLoggedIn && f.lastLoggedIn < oneYearAgo;

                return !isPrivate && isOldEnough && !isDead;
            })
            .sort((a, b) => {
                const aLastLoggedIn = a.lastLoggedIn ?? new Date(0);
                const bLastLoggedIn = b.lastLoggedIn ?? new Date(0);
                return bLastLoggedIn.getTime() - aLastLoggedIn.getTime();
            })
            .slice(0, 100);

        // Get owned games for each friend
        const { data: ownedGames, error: err2 } = await steamRepo.getOwnedGames(filteredFriends);
        const filteredFriendsWithGame = filteredFriends.filter((friend) => {
            const friendOwnedGames = ownedGames.get(friend.id) ?? [];
            return friendOwnedGames.some((game) => game.id === app.id);
        });

        // Fetch achievements for each friend who owns the game
        const { data: achievements, error: err3 } = await steamRepo.getUserAchievements([app], filteredFriendsWithGame);
        const achievementsForGame = achievements.get(app.id);

        const friendsWithAchievement = filteredFriendsWithGame
            .map((f) => ({
                friend: f,
                achievement: achievementsForGame?.get(f.id)?.get(achievement.id),
            }))
            .filter((f) => f.achievement?.unlocked);

        return new Errable(friendsWithAchievement, err1 ?? err2 ?? err3);
    })();

    const articles = (async () => {
        if (url.searchParams.get("tab") !== "articles") return null;

        const { data: articles, error: err1 } = await steamComRepo.searchGuides(achievement, "english");
        const { data: videos, error: err2 } = await youtubeRepo.searchGuides(achievement, "english");

        return new Errable(
            {
                articles: articles.slice(0, 3),
                videos: videos.slice(0, 3),
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

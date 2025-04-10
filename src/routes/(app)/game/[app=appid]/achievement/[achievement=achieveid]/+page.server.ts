import { EnhancedSteamRepository } from "$lib/server/enhanced/repo";
import { Errable } from "$lib/error";

export const load = async ({ parent, url }) => {
    const data = await parent();
    const { app, user, achievement } = data;

    const repo = new EnhancedSteamRepository();

    const game = await repo.getGameAchievements([app]);
    const gameAchievements = game.data.get(app.id);

    const friendsWithAchievement = (async () => {
        if (!user) return new Errable(null, null);
        if (url.searchParams.get("tab") !== "friends") return new Errable(null, null);

        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        // Fetch friends who own the game
        const { data: friends, error: err1 } = await repo.getFriends([user]);
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
        const { data: ownedGames, error: err2 } = await repo.getOwnedGames(filteredFriends);
        const filteredFriendsWithGame = filteredFriends.filter((friend) => {
            const friendOwnedGames = ownedGames.get(friend.id) ?? [];
            return friendOwnedGames.some((game) => game.id === app.id);
        });
        // console.log(filteredFriendsWithGame);

        // Fetch achievements for each friend who owns the game
        const { data: achievements, error: err3 } = await repo.getUserAchievements([app], filteredFriendsWithGame);
        const achievementsForGame = achievements.get(app.id);

        const friendsWithAchievement = filteredFriendsWithGame
            .map((f) => ({
                friend: f,
                achievement: achievementsForGame?.get(f.id)?.get(achievement.id),
            }))
            .filter((f) => f.achievement?.unlocked);

        // console.log(friendsWithAchievement);

        return new Errable(friendsWithAchievement, err1 ?? err2 ?? err3);
    })();

    return {
        gameAchievements,
        friendsWithAchievement,
    };
};

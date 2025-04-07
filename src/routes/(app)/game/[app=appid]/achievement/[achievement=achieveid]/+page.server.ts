import { EnhancedSteamRepository } from "$lib/server/enhanced/repo";
import { Errable } from "$lib/server/error";

export const load = async ({ parent }) => {
    const data = await parent();
    const { app, user, achievement } = data;

    const repo = new EnhancedSteamRepository();

    const game = await repo.getGameAchievements([app]);
    const gameAchievements = game.data.get(app.id);

    const friendsWithAchievement = (async () => {
        if (!user) return new Errable([], null);

        // Fetch friends who own the game
        const { data: friends, error: err1 } = await repo.getFriends([user]);
        const filteredFriends = [...friends.values()]
            .flat()
            .filter((f) => {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                const isPrivate = f.private;
                const isOld = f.created && f.created < oneMonthAgo;
                const isDead = f.lastLoggedIn && f.lastLoggedIn < oneYearAgo;

                return !isPrivate && isOld && !isDead;
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
            const ownedGame = ownedGames.get(friend.id);
            if (!ownedGame) return false;
            return ownedGame.some((game) => game.id === app.id);
        });

        // Fetch achievements for each friend who owns the game
        const { data: achievements, error: err3 } = await repo.getUserAchievements([app], filteredFriendsWithGame);
        const achievementsForGame = achievements.get(app.id);

        const friendsWithAchievement = filteredFriendsWithGame
            .map((f) => ({
                friend: f,
                achievement: achievementsForGame?.get(f.id)?.get(achievement.id),
            }))
            .filter((f) => f.achievement?.unlocked);

        return new Errable(friendsWithAchievement, err1 ?? err2 ?? err3);
    })();

    return {
        gameAchievements,
        friendsWithAchievement,
    };
};

type a = {
    id: "against-all-odds";
    name: "Against All Odds";
    description: "Complete the final mission on Insane difficulty without any squad member dying";
    rarity: 0.8;
    icon: "/placeholder.svg?height=48&width=48";
    unlocked: "2023-05-15T14:32:00Z";
    isCurrent: true;
};

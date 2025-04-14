import { EnhancedSteamRepository, Errable, type SteamAppAchievement } from "lib";

export const load = async ({ parent, locals }) => {
    const { app } = await parent();

    const repo = new EnhancedSteamRepository(locals);

    let achievements: Map<string, SteamAppAchievement> | undefined;
    let err: Error | null = null;
    if (locals.steamUser) {
        const { data: achievementsMap, error: achieveErr } = await repo.getUserAchievements([app], [locals.steamUser]);
        achievements = achievementsMap.get(app.id)?.get(locals.steamUser.id);
        err = achieveErr;
    } else {
        const { data: achievementsMap, error: achieveErr } = await repo.getGameAchievements([app]);
        achievements = achievementsMap.get(app.id);
        err = achieveErr;
    }

    const friends = (async () => {
        if (!locals.steamUser) return undefined;

        const { data: friendMap, error: err1 } = await repo.getFriends([locals.steamUser]);

        const f = friendMap.get(locals.steamUser.id);
        if (!f) return undefined;
        const a = f[0];

        const { data: ownedMap, error: err2 } = await repo.getOwnedGames(f);

        // ONLY FETCH THE CURRENT APP
        const { data: friendAchievements, error: err3 } = await repo.getUserAchievements([app], f, "english");

        // Map back into friends
        return {
            friends: new Errable(
                f
                    .map((friend) => {
                        const ownedGames = ownedMap.get(friend.id);
                        const ownedGame = ownedGames?.find((game) => game.id === app.id);
                        if (!ownedGame?.playtime || ownedGame.playtime === 0) return null;
                        const achievements = friendAchievements.get(app.id)?.get(friend.id);
                        if (!achievements) return null;
                        const friendAchievementsList = [...achievements.values()].flat();
                        if (!friendAchievementsList) return null;
                        return {
                            user: friend,
                            owned: ownedGame,
                            achievements: friendAchievementsList,
                        };
                    })
                    .filter((friend) => friend !== null)
                    .sort((a, b) => (b.owned.playtime ?? 0) - (a.owned.playtime ?? 0)),
                err1 || err2 || err3,
            ),
        };
    })();

    return {
        achievements,
        didErr: Boolean(err),
        friends,
    };
};

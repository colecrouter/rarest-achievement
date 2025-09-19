import { Attempt, SteamCommunityRepo, YouTubeRepository } from "@project/lib";
import { GOOGLE_API_KEY } from "$env/static/private";
import { getLocale } from "$lib/paraglide/runtime.js";

export const load = async ({ parent, url, locals, platform }) => {
	const locale = getLocale();

	const data = await parent();
	const { app, loggedIn, achievement, gameAchievements } = data;
	if (!platform) throw new Error("No platform found");

	const steamComRepo = new SteamCommunityRepo(platform.env.STEAM_CACHE, locals.steamCommunityClient);
	const youtubeRepo = new YouTubeRepository(GOOGLE_API_KEY, platform.env.STEAM_CACHE, platform.env.AI);

	const friendsWithAchievement = (async () => {
		/*
			Goal: Get a list of friends who have unlocked this achievement, including how many achievements
			they have unlocked in total for this game.

			Steps:
			1. Get friends of the logged-in user who own the game and have unlocked the achievement.
			2. Filter out friends who are inactive (not logged in for over a month), private profiles, or newly created accounts (less than a month old).
			3. For each remaining friend, count how many achievements they have unlocked in total for this game.
			4. Sort the friends by their last logged-in date, most recent first.
			5. Return the list of friends with their achievement info and counts.
		*/

		if (!loggedIn) return null;
		if (url.searchParams.get("tab") !== "friends") return null;

		const oneMonthAgo = new Date();
		oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

		// Fetch achievements for each friend who owns the game
		const unlockedAchievementsAttempt = await locals.vault.userAchievements
			.compose()
			.withLanguage(locale)
			.withFriendsOf(loggedIn.id)
			.withAppIds(app.id)
			.withAchievementIds(achievement.id)
			.withUnlockedStatus(true)
			.build({ limit: 32 }); // TODO

		// Separately get user total achievements *count-only*
		// Getting all achievements uses too much memory

		// biome-ignore lint/style/noNonNullAssertion: It shouldn't be possible for User to be nullish in this context
		const usersMap = new Map(unlockedAchievementsAttempt.data.map((a) => [a.user?.id!, a.user!]));
		const filteredUsers = usersMap
			.values()
			.filter((u) => u !== undefined)
			.filter(
				// Active in last month, created more than a month ago, not private
				(u) =>
					u.lastLoggedIn &&
					u.lastLoggedIn >= oneMonthAgo &&
					u.created &&
					u.created < oneYearAgo &&
					!u.private,
			)
			.toArray()
			.sort((a, b) => {
				// Sort by last logged in first (safe when user may be undefined)
				const aLast = a?.lastLoggedIn ?? new Date(0);
				const bLast = b?.lastLoggedIn ?? new Date(0);
				return bLast.getTime() - aLast.getTime();
			});

		// Raw dog count (for now)
		const completedAttempt = await Attempt.all(
			filteredUsers.map((user) =>
				locals.vault.userAchievements
					.compose()
					.withUserIds(user.id)
					.withAppIds(app.id)
					.withUnlockedStatus(true)
					.count()
					.then((a) => [user, a.data ?? 0] as const),
			),
		);

		// @ts-expect-error Attempt.all returns undefined on failure (shouldn't happen here, limitation with typing methinks)
		const completedCountMap = new Map(completedAttempt.data);

		const assert = () => {
			throw new Error("Unreachable");
		};
		const friendsAchievements = filteredUsers
			.map((user) => ({
				achievement: unlockedAchievementsAttempt.data.find((a) => a.user?.id === user.id) ?? assert(),
				unlockedCount: completedCountMap.get(user) ?? 0,
				totalCount: gameAchievements?.data.length ?? assert(),
			}))
			.filter((x) => x.achievement !== undefined);

		// Carry any errors
		return unlockedAchievementsAttempt.and(completedAttempt).map(() => friendsAchievements);
	})();

	const articles = (async () => {
		if (url.searchParams.get("tab") !== "articles") return null;

		const { data: articles, error: err1 } = await steamComRepo.searchGuides(achievement);
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
		friendsWithAchievement,
		articles,
	};
};

import { getLocale } from "$lib/paraglide/runtime.js";
import { Attempt, type SteamUser } from "@project/lib";

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

		// Fetch achievements for each friend who owns the game (to discover friend users)
		const achievementsAttempt = await locals.vault.userAchievements
			.compose()
			.withLanguage(locale)
			.withAppIds(app.id)
			.withFriendsOf(locals.steamUser.id)
			.build({ limit: 10000 }); // TODO: cap sensibly

		// Build a distinct set of users from the achievements
		// Narrow to items with a user and collect unique users by id
		type Item = (typeof achievementsAttempt.data)[number];
		const withUser = achievementsAttempt.data.filter(
			(a): a is Item & { user: NonNullable<Item["user"]> } => a.user !== undefined,
		);
		const distinctUsers = new Map(withUser.map((a) => [a.user.id, a.user] as const));

		// Filter users: active recently, older than a year, not private
		const filteredUsers = distinctUsers
			.values()
			.filter((u) => u !== undefined)
			.filter(
				(u) =>
					u.lastLoggedIn &&
					u.lastLoggedIn >= oneMonthAgo &&
					u.created &&
					u.created < oneYearAgo &&
					!u.private,
			)
			.toArray()
			.sort((a, b) => {
				const aLast = a?.lastLoggedIn ?? new Date(0);
				const bLast = b?.lastLoggedIn ?? new Date(0);
				return bLast.getTime() - aLast.getTime();
			});

		// Count unlocked achievements per user (memory-safe)
		const unlockedCountsAttempt = await Attempt.all(
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
		const unlockedEntries: Array<readonly [SteamUser, number]> = [];
		for (const e of unlockedCountsAttempt.data ?? []) {
			if (e?.[0] && typeof e?.[1] === "number") {
				unlockedEntries.push(e as readonly [SteamUser, number]);
			}
		}
		const unlockedCounts = new Map<SteamUser, number>(unlockedEntries);

		// Total achievement count for the app (shared for all rows)
		const totalCountAttempt = await locals.vault.appAchievements.compose().withAppIds(app.id).count();

		// Build summaries using a representative achievement per user
		const summaries = filteredUsers.map((user) => {
			const representative = achievementsAttempt.data.find((a) => a.user?.id === user.id);
			return {
				totalCount: totalCountAttempt.data ?? 0,
				unlockedCount: unlockedCounts.get(user) ?? 0,
				achievement: representative,
			};
		});

		return achievementsAttempt
			.and(unlockedCountsAttempt)
			.and(totalCountAttempt)
			.map(() => summaries);
	})();

	return {
		achievements,
		friendsWithAchievement,
	};
};

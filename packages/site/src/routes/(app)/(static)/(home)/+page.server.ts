import {
	type APILanguageCode,
	achievementsMeta,
	achievementsStats,
	apps,
	getLanguageByCode,
	resolveSteamID,
	SteamApp,
	SteamAppAchievement,
	type SteamID,
	userAchievements,
	userScores,
} from "@project/lib";
import { fail, redirect } from "@sveltejs/kit";
import { and, count, countDistinct, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getLocale, type Locale, localizeHref, localizeUrl } from "$lib/paraglide/runtime.js";

export const actions = {
	search: async ({ request }) => {
		const formData = await request.formData();
		const query = formData.get("q")?.toString();
		if (!query) return fail(400, { msg: "No query" });

		let id: SteamID;
		try {
			id = await resolveSteamID(query);
		} catch (e) {
			// TODO
			console.error(e);
			return fail(400, { msg: (e as Error).message });
		}

		return redirect(302, `/user/${id.toSteamID(1)}`);
	},
	login: async ({ url }) => {
		const baseUrl = new URL("https://steamcommunity.com/openid/login");

		const redirectUrl = localizeUrl(new URL("/auth/steam/callback", url.origin));

		// These parameters follow the OpenID 2.0 spec for Steam.
		const params = new URLSearchParams({
			"openid.ns": "http://specs.openid.net/auth/2.0",
			"openid.mode": "checkid_setup",
			// This should point to your callback endpoint.
			"openid.return_to": redirectUrl.toString(),
			// This is your realm, typically your home page domain.
			"openid.realm": url.origin,
			// Using identifier select allows Steam to pick up the user’s Steam ID.
			"openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
			"openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
		});

		// Redirect the user to Steam's OpenID endpoint with the parameters.
		// This will initiate the OpenID authentication process.
		baseUrl.search = params.toString();
		redirect(302, baseUrl);
	},
	logout: async ({ cookies }) => {
		// Clear the Steam ID cookie to log out the user.
		cookies.delete("steamid", { path: "/" });
		// Optionally, redirect the user to a different page after logging out.
		return redirect(302, localizeHref("/"));
	},
};

export const load = async ({ locals }) => {
	// Need to get locale before streaming, or else errors ensue
	const locale = getLocale();

	return {
		showcase2: await getShowcaseAchievements(locals, locale),
		stats: await getStats(locals),
		featuredAchievements: await getRareAchievements(locals, locale),
		random: [0, 0, 0].map(() => Math.floor(Math.random() * 500) + 500) as [number, number, number],
	};
};

const getShowcaseAchievements = async (locals: App.Locals, locale: Locale) => {
	const showcase2IDs = [
		{ game: 252950, achievement: "Spectacular" },
		{ game: 367520, achievement: "STEELSOUL_COMPLETION" },
		{ game: 1085660, achievement: "ACH_23" },
	];

	// Fetch the achievements for the showcase cards
	const showcase2Achievements = await locals.vault.appAchievements
		.compose()
		.withLanguage(locale)
		.withAppIds(showcase2IDs.map((m) => m.game))
		.withAchievementIds(showcase2IDs.map((m) => m.achievement))
		.build();

	if (showcase2Achievements.data.length !== 3) throw new Error("Missing achievements");

	return showcase2Achievements.data;
};

const getStats = async (locals: App.Locals) => {
	// Fetch statistics
	const [[userCounts], [gamesIndexed], [achievementsIndexed]] = await locals.steamCacheDB.batch([
		locals.steamCacheDB.select({ userCount: countDistinct(userScores.user_id) }).from(userScores),
		locals.steamCacheDB.select({ gameCount: countDistinct(apps.id) }).from(apps),
		locals.steamCacheDB
			.select({
				achievementCount: count(achievementsStats.ach_id),
			})
			.from(achievementsStats),
	]);
	const [userCount, gameCount, achievementCount] = [
		userCounts?.userCount ?? 0,
		gamesIndexed?.gameCount ?? 0,
		achievementsIndexed?.achievementCount ?? 0,
	];

	return {
		userCount,
		gameCount,
		achievementCount,
	};
};

const getRareAchievements = async (locals: App.Locals, locale: Locale) => {
	const lang = getLanguageByCode(locale)?.apiCode as APILanguageCode;

	const ranked = locals.steamCacheDB
		.select({
			appId: userAchievements.app_id,
			name: userAchievements.ach_id,
			percent: achievementsStats.percent,
			rn: sql`ROW_NUMBER() OVER (
                    PARTITION BY ${userAchievements.app_id}
                    ORDER BY ${achievementsStats.percent} ASC
                )`.as("rn"),
		})
		.from(userAchievements)
		.innerJoin(
			achievementsStats,
			and(
				eq(achievementsStats.app_id, userAchievements.app_id),
				eq(achievementsStats.ach_id, userAchievements.ach_id),
			),
		)
		.where(and(isNotNull(userAchievements.unlocked_at), lte(achievementsStats.percent, 5)))
		.as("ranked");

	const rareRows = await locals.steamCacheDB
		.select({
			appId: ranked.appId,
			name: ranked.name,
			percent: ranked.percent,
			defaultValue: achievementsMeta.default_value,
			displayName: achievementsMeta.display_name,
			hidden: achievementsMeta.hidden,
			description: achievementsMeta.description,
			icon: achievementsMeta.icon,
			iconGray: achievementsMeta.icon_gray,
		})
		.from(ranked)
		.innerJoin(
			achievementsMeta,
			and(
				eq(achievementsMeta.app_id, ranked.appId),
				eq(achievementsMeta.lang, lang),
				eq(achievementsMeta.ach_id, ranked.name),
			),
		)
		.where(lte(ranked.rn, 3))
		.orderBy(sql`RANDOM()`) // Randomly select 3 rare achievements
		.limit(3);

	const appIds = rareRows.map((row) => row.appId);

	const appsRes = await locals.steamCacheDB.select({ app: apps.data }).from(apps).where(inArray(apps.id, appIds));

	const constructedApps = appsRes.map((a) => {
		if (!a.app) throw new Error("Missing app data");
		return new SteamApp({ data: a.app, lang, estimatedPlayers: 0 });
	});

	const constructedAchievements = rareRows.map((row) => {
		const app = constructedApps.find((a) => a.id === row.appId);
		if (!app) throw new Error(`App with ID ${row.appId} not found`);
		return new SteamAppAchievement({
			app,
			meta: {
				name: row.name,
				defaultvalue: row.defaultValue,
				description: row.description ?? undefined,
				displayName: row.displayName,
				hidden: row.hidden,
				icon: row.icon,
				icongray: row.iconGray,
			},
			globalStats: {
				name: row.name,
				percent: row.percent,
			},
			lang,
		});
	});

	return constructedAchievements;
};

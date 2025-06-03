import { type Locale, getLocale, localizeHref, localizeUrl } from "$lib/paraglide/runtime.js";
import {
    type APILanguageCode,
    EnhancedSteamRepository,
    type SteamAchievementRawGlobalStats,
    type SteamAchievementRawMeta,
    SteamApp,
    SteamAppAchievement,
    type SteamID,
    achievementsStats,
    apps,
    getLanguageByCode,
    resolveSteamID,
    userScores,
} from "@project/lib";
import { fail, redirect } from "@sveltejs/kit";
import { countDistinct, inArray, sql, sum } from "drizzle-orm";

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
    };
};

const getShowcaseAchievements = async (locals: App.Locals, locale: Locale) => {
    const showcase2IDs = [
        { game: 252950, achievement: "Spectacular" },
        { game: 367520, achievement: "STEELSOUL_COMPLETION" },
        { game: 1085660, achievement: "ACH_23" },
    ];

    // Fetch the achievements for the showcase cards
    const repo = new EnhancedSteamRepository(locals);
    const { data: showcase2Apps } = await repo.getApps(
        showcase2IDs.map((m) => m.game),
        locale,
    );
    const { data: showcase2Achievements } = await repo.getGameAchievements([...showcase2Apps.values()], locale);

    const showcase2 = showcase2IDs
        .map(({ game, achievement }) => showcase2Achievements.get(game)?.get(achievement))
        .filter((m) => !!m);
    if (showcase2.length !== 3) throw new Error("Missing achievements");

    return showcase2;
};

const getStats = async (locals: App.Locals) => {
    // Fetch statistics
    const [[userCounts], [gamesIndexed], [achievementsIndexed]] = await locals.steamCacheDB.batch([
        locals.steamCacheDB.select({ userCount: countDistinct(userScores.user_id) }).from(userScores),
        locals.steamCacheDB.select({ gameCount: countDistinct(apps.id) }).from(apps),
        locals.steamCacheDB
            .select({
                achievementCount: sum(sql<number>`json_array_length(${achievementsStats.data})`),
            })
            .from(achievementsStats),
    ]);
    const [userCount, gameCount, achievementCount] = [
        userCounts?.userCount ?? 0,
        gamesIndexed?.gameCount ?? 0,
        Number.parseInt(achievementsIndexed?.achievementCount ?? "0"),
    ];

    return {
        userCount,
        gameCount,
        achievementCount,
    };
};

const getRareAchievements = async (locals: App.Locals, locale: Locale) => {
    const lang = getLanguageByCode(locale)?.apiCode as APILanguageCode;

    const query = sql`
        WITH UserUnlocked AS (
            SELECT
            ua.app_id,
            u.value AS uv
            FROM user_achievements_stats AS ua,
                json_each(ua.data) AS u
            WHERE json_extract(u.value, '$.achieved') = 1
        ),
        Ranked AS (
            SELECT
            uu.app_id,
            uu.uv,
            gs.value AS gv,
            ROW_NUMBER() OVER (
                PARTITION BY uu.app_id
                ORDER BY cast(json_extract(gs.value, '$.percent') AS float) ASC
            ) AS rn
            FROM UserUnlocked uu
            JOIN achievements_stats ast
            ON ast.app_id = uu.app_id
            JOIN json_each(ast.data) AS gs
            ON json_extract(gs.value, '$.name') = json_extract(uu.uv, '$.apiname')
            WHERE cast(json_extract(gs.value, '$.percent') AS float) <= 5
        )
        SELECT
            r.app_id,
            json_extract(r.gv, '$.name')          AS name,
            json_extract(r.gv, '$.percent')       AS percent,
            json_extract(meta.value, '$.defaultvalue')  AS defaultvalue,
            json_extract(meta.value, '$.displayName')   AS displayName,
            json_extract(meta.value, '$.hidden')        AS hidden,
            json_extract(meta.value, '$.description')   AS description,
            json_extract(meta.value, '$.icon')          AS icon,
            json_extract(meta.value, '$.icongray')      AS icongray
        FROM Ranked AS r
        JOIN achievements_meta
            ON achievements_meta.app_id = r.app_id
        AND achievements_meta.lang = ${lang}
        JOIN json_each(achievements_meta.data) AS meta
            ON json_extract(meta.value, '$.name') = json_extract(r.gv, '$.name')
        WHERE r.rn <= 3
        ORDER BY RANDOM()
        LIMIT 3;
        `;

    const res = await locals.steamCacheDB.run(query);
    const results = res.results as Array<SteamAchievementRawMeta & SteamAchievementRawGlobalStats & { app_id: number }>;

    const appsRes = await locals.steamCacheDB
        .select({ app: apps.data })
        .from(apps)
        .where(
            inArray(
                apps.id,
                results.map((m) => m.app_id),
            ),
        );

    const achievements = results.map((m) => {
        const app = appsRes.find((a) => a.app?.steam_appid === m.app_id);
        if (!app?.app) throw new Error("Missing app");
        return new SteamAppAchievement(new SteamApp(app.app.steam_appid, app.app, 0, lang), m, m, lang);
    });

    return achievements;
};

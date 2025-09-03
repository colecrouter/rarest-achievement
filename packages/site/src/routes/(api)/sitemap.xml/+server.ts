import { achievementsStats, apps, estimatedPlayers } from "@project/lib";
import { asc, desc, eq, sql } from "drizzle-orm";
import { locales, localizeUrl } from "$lib/paraglide/runtime";

const _xmlEscapeMap: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"'": "&apos;",
	'"': "&quot;",
};

const _xmlEscapeRe = /[&<>'"]/g;

const escapeXml = (str: string) => str.replace(_xmlEscapeRe, (ch) => _xmlEscapeMap[ch] ?? ch);

export const GET = async ({ url, setHeaders, locals }) => {
	console.time("Sitemap generation");
	const baseUrl = url.origin;

	// Fetch all cached data from database
	const achievements = await locals.steamCacheDB
		.select({
			apps,
			achievement_stats: achievementsStats,
			estimated_players: estimatedPlayers,
		})
		.from(apps)
		.leftJoin(achievementsStats, eq(apps.id, achievementsStats.app_id))
		.leftJoin(estimatedPlayers, eq(apps.id, estimatedPlayers.app_id))
		// Sort by most common games, then rarest achievements
		.orderBy(desc(estimatedPlayers.estimated_players), asc(achievementsStats.percent))
		// Filter out achievements with percent >= 10 (10%)
		.where(sql`${achievementsStats.percent} <= 10`);

	// Create XML entries for each page.
	const generateXml = (url: string, lastmod?: Date) => {
		return /* xml */ `
            <url>
                <loc>${escapeXml(url)}</loc>
                ${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ""}
                ${locales
					.map(
						(locale) => /* xml */ `
                            <xhtml:link rel="alternate" hreflang="${locale}" href="${localizeUrl(escapeXml(url), { locale })}" />`,
					)
					.join("\n")}
            </url>`;
	};

	// Group achievements by app to avoid duplicate app pages
	const appGroups = new Map<
		number,
		{
			app: (typeof achievements)[0]["apps"];
			achievements: Array<{ ach_id: string; percent: number }>;
		}
	>();

	for (const row of achievements) {
		const appId = row.apps.id;
		if (!appGroups.has(appId)) {
			appGroups.set(appId, {
				app: row.apps,
				achievements: [],
			});
		}

		if (row.achievement_stats) {
			const appGroup = appGroups.get(appId);
			if (appGroup) {
				appGroup.achievements.push({
					ach_id: row.achievement_stats.ach_id,
					percent: row.achievement_stats.percent,
				});
			}
		}
	}

	const sitemapEntries = [
		...new Set(
			Array.from(appGroups.values()).flatMap((group) => {
				const appUrl = `${baseUrl}/game/${group.app.id}`;
				const lastmod = group.app.updated_at;
				const appPage = generateXml(appUrl, lastmod);

				const achievementPages = group.achievements.map((achievement) => {
					const achievementUrl = `${baseUrl}/game/${group.app.id}/achievement/${encodeURIComponent(achievement.ach_id)}`;
					return generateXml(achievementUrl, lastmod);
				});

				return [appPage, achievementPages].flat();
			}),
		),
	];

	// Add static entries
	const staticEntries = [
		generateXml(`${baseUrl}/`),
		generateXml(`${baseUrl}/about`),
		generateXml(`${baseUrl}/legal`),
		generateXml(`${baseUrl}/legal?tab=terms`),
	];

	// Combine static and dynamic entries and limit to 50,000 entries.
	const allEntries = [...staticEntries, ...sitemapEntries].flat();
	const limitedEntries = allEntries.slice(0, 40000);
	console.log(`Sitemap entries: ${allEntries.length}`);

	// Complete XML sitemap
	const sitemap = /* xml */ `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
        ${limitedEntries.join("\n")}
    </urlset>`.replace(/\n\s*/g, "");

	// Set the proper headers and return the sitemap content
	setHeaders({
		"Content-Type": "application/xml",
		"Cache-Control": "public, max-age=0, s-maxage=86400",
	});

	console.timeEnd("Sitemap generation");

	return new Response(sitemap);
};

// respond to HEAD the same as GET so Googlebot can "fetch"
export const HEAD = GET;

import { achievementsStats, apps, estimatedPlayers } from "@project/lib";
import type { RequestHandler } from "./$types";
import { eq, sql, asc, desc } from "drizzle-orm";

export const GET: RequestHandler = async ({ url, setHeaders, locals }) => {
    const baseUrl = url.origin;

    // Fetch all cached data from database
    const achievements = await locals.steamCacheDB
        .select()
        .from(apps)
        .leftJoin(achievementsStats, eq(apps.id, achievementsStats.app_id))
        .leftJoin(estimatedPlayers, eq(apps.id, estimatedPlayers.app_id))
        // Sort by most common games, then rarest achievements
        .orderBy(
            asc(sql`CAST(json_extract(achievements_stats.data, '$[0].percent' ) AS DECIMAL)`),
            desc(estimatedPlayers.estimated_players),
        )
        // Filter out achievements with percent >= 20
        .where(sql`CAST(json_extract(achievements_stats.data, '$[0].percent') AS DECIMAL) <= 20`);

    // Create XML entries for each page.
    const generateXml = (url: string, lastmod?: Date) => {
        return /* xml */ `
      <url>
        <loc>${url}</loc>
        ${lastmod ? /* xml */ `<lastmod>${lastmod.toISOString()}</lastmod>` : ""}
      </url>`;
    };

    const sitemapEntries = [
        ...new Set(
            achievements.flatMap((page) => {
                const appUrl = `${baseUrl}/game/${page.apps.id}`;
                const lastmod = page.apps.updated_at;
                const appPage = generateXml(appUrl, lastmod);

                const achievementPages = (page.achievements_stats?.data ?? []).map((achievement) => {
                    const achievementUrl = `${baseUrl}/game/${page.apps.id}/achievements/${achievement.name}`;
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
    const sitemap = /* xml */ `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${limitedEntries.join("\n")}
    </urlset>`;

    // Set the proper headers and return the sitemap content
    setHeaders({
        "Content-Type": "application/xml",
    });

    return new Response(sitemap);
};

import { locales, localizeUrl } from "$lib/paraglide/runtime";
import { achievementsStats, apps, estimatedPlayers } from "@project/lib";
import { asc, desc, eq, sql } from "drizzle-orm";

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
        .select()
        .from(apps)
        .leftJoin(achievementsStats, eq(apps.id, achievementsStats.app_id))
        .leftJoin(estimatedPlayers, eq(apps.id, estimatedPlayers.app_id))
        // Sort by most common games, then rarest achievements
        .orderBy(
            desc(estimatedPlayers.estimated_players),
            asc(sql`CAST(json_extract(achievements_stats.data, '$[0].percent' ) AS DECIMAL)`),
        )
        // Filter out achievements with percent >= 20
        .where(sql`CAST(json_extract(achievements_stats.data, '$[0].percent') AS DECIMAL) <= 10`);

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

    const sitemapEntries = [
        ...new Set(
            achievements.flatMap((page) => {
                const appUrl = `${baseUrl}/game/${page.apps.id}`;
                const lastmod = page.apps.updated_at;
                const appPage = generateXml(appUrl, lastmod);

                const achievementPages = (page.achievements_stats?.data ?? []).map((achievement) => {
                    const achievementUrl = `${baseUrl}/game/${page.apps.id}/achievements/${encodeURIComponent(achievement.name)}`;
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

// respond to HEAD the same as GET so Googlebot can “fetch”
export const HEAD = GET;

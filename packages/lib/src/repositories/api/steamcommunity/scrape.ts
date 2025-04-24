import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import type { HTMLRewriter } from "htmlrewriter";
import type { Language } from "../lang";

const resolveHTMLRewriter = async () =>
    "HTMLRewriter" in globalThis
        ? (globalThis as unknown as typeof import("htmlrewriter")).HTMLRewriter
        : import("htmlrewriter").then((m) => m.HTMLRewriter);

type Element = Parameters<NonNullable<(typeof HTMLRewriter.prototype.elementHandlers)[number][1]["element"]>>[0];
type TextChunk = Parameters<NonNullable<(typeof HTMLRewriter.prototype.documentHandlers)[number]["text"]>>[0];
type DocType = Parameters<NonNullable<(typeof HTMLRewriter.prototype.documentHandlers)[number]["doctype"]>>[0];
type Comment = Parameters<NonNullable<(typeof HTMLRewriter.prototype.documentHandlers)[number]["comments"]>>[0];
type EndTag = Parameters<NonNullable<(typeof HTMLRewriter.prototype.documentHandlers)[number]["end"]>>[0];

// Define an Article interface
export interface Article {
    title: string;
    author: string;
    description: string;
    stars: number;
    thumbnail: string;
    id: number;
}

// Shared context for handlers
interface ScrapeContext {
    titles: string[];
    authors: string[];
    descriptions: string[];
    stars: number[];
    thumbnails: string[];
    ids: number[];
}

// Handler to scrape the article title text chunks.
class TitleHandler {
    context: ScrapeContext;
    buffer: string;
    constructor(context: ScrapeContext) {
        this.context = context;
        this.buffer = "";
    }
    element(element: Element) {
        // Nothing on element start
    }
    text(textChunk: TextChunk) {
        this.buffer += textChunk.text;
        if (textChunk.lastInTextNode) {
            this.context.titles.push(this.buffer.trim());
            this.buffer = "";
        }
    }
}

// Handler to scrape the article author name.
class AuthorHandler {
    context: ScrapeContext;
    buffer: string;
    constructor(context: ScrapeContext) {
        this.context = context;
        this.buffer = "";
    }
    element(element: Element) {}
    text(textChunk: TextChunk) {
        this.buffer += textChunk.text;
        if (textChunk.lastInTextNode) {
            this.context.authors.push(this.buffer.trim());
            this.buffer = "";
        }
    }
}

// Handler to scrape the article description.
class DescriptionHandler {
    context: ScrapeContext;
    buffer: string;
    constructor(context: ScrapeContext) {
        this.context = context;
        this.buffer = "";
    }
    element(element: Element) {}
    text(textChunk: TextChunk) {
        this.buffer += textChunk.text;
        if (textChunk.lastInTextNode) {
            this.context.descriptions.push(this.buffer.trim());
            this.buffer = "";
        }
    }
}

// Handler to scrape the rating image.
// We check the "src" attribute to see if it includes "5-star".
class StarHandler {
    context: ScrapeContext;
    constructor(context: ScrapeContext) {
        this.context = context;
    }
    element(element: Element) {
        const src = element.getAttribute("src") || "";
        // If the img src contains "5-star", assume 5 stars, otherwise 0.
        const matches = src.match(/(\d+)-star/)?.[1];
        const stars = matches ? Number.parseInt(matches, 10) : 0;
        this.context.stars.push(stars);
    }
}

// Handler to scrape the thumbnail image URL.
class ThumbnailHandler {
    context: ScrapeContext;
    constructor(context: ScrapeContext) {
        this.context = context;
    }
    element(element: Element) {
        const src = element.getAttribute("src") || "";
        this.context.thumbnails.push(src);
    }
}

// Handler to get the ID of the article.
class ArticleIDHandler {
    context: ScrapeContext;
    constructor(context: ScrapeContext) {
        this.context = context;
    }
    element(element: Element) {
        const id = element.getAttribute("data-publishedfileid") || "";
        this.context.ids.push(Number.parseInt(id));
    }
}

/**
 * Scrapes the Steam Community page for articles related to a specific achievement.
 * @param achievement The achievement to search for.
 * @returns An array of Article objects containing the scraped data.
 */
export async function scrapeSteamCommunityArticles(
    achievement: SteamAppAchievement | SteamUserAchievement,
    lang: Language,
): Promise<Article[]> {
    const url = new URL(`https://steamcommunity.com/app/${achievement.app.id}/guides/`);
    // ?searchText=gold+medal&browsefilter=trend&browsesort=creationorder&requiredtags%5B%5D=Achievements&requiredtags%5B%5D=English#scrollTop=0
    url.searchParams.set("searchText", achievement.name);
    url.searchParams.set("browsefilter", "toprated");
    url.searchParams.set("browsesort", "toprated");
    url.searchParams.set("requiredtags[]", "Achievements");
    url.searchParams.set("p", "0");
    if (lang) url.searchParams.set("requiredtags[]", lang);

    const response = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch articles: ${response.statusText}`);
    }

    const context: ScrapeContext = {
        titles: [],
        authors: [],
        descriptions: [],
        stars: [],
        thumbnails: [],
        ids: [],
    };

    const HTMLRewriter = await resolveHTMLRewriter();

    const rewriter = new HTMLRewriter()
        .on(".workshopItemTitle", new TitleHandler(context))
        .on(".workshopItemAuthorName", new AuthorHandler(context))
        .on(".workshopItemShortDesc", new DescriptionHandler(context))
        .on("img.fileRating", new StarHandler(context))
        .on("img.workshopItemPreviewImage", new ThumbnailHandler(context))
        .on("div.workshopItemCollection", new ArticleIDHandler(context));

    // Trigger transformation and fully consume the stream.
    await rewriter.transform(response).text();

    // Build Article objects by assuming same order of occurrence.
    const articles: Article[] = [];
    const count = context.titles.length;
    for (let i = 0; i < count; i++) {
        articles.push({
            title: context.titles[i] ?? "",
            author: context.authors[i] || "",
            description: context.descriptions[i] || "",
            stars: context.stars[i] || 0,
            thumbnail: context.thumbnails[i] || "", // include the thumbnail URL
            id: context.ids[i] || 0, // include the article ID
        });
    }
    return articles;
}

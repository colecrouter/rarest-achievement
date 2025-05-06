import type { HTMLRewriter } from "htmlrewriter";
import { unescapeHTML } from "../utils";
import { getHTMLRewriter } from "./htmlRewriterHelper";
import type { User } from "./types";

const userIDRegex = /https:\/\/steamcommunity\.com\/profiles\/([a-zA-Z0-9_]{2,32})/;
const sessionIDRegex = /g_sessionID\s*=\s*"([^"]+)"/;
// Showing 1 - 3 of 3
const countRegex = /Showing\s+\d+\s+-\s+\d+\s+of\s+([0-9,]+)/;

interface UserScrapeContext {
    names: string[];
    userIds: string[];
    avatarUrls: string[];
    count: number;
}

interface SessionIDContext {
    sessionID: string;
}

type Element = Parameters<NonNullable<(typeof HTMLRewriter.prototype.elementHandlers)[number][1]["element"]>>[0];
type TextChunk = Parameters<NonNullable<(typeof HTMLRewriter.prototype.documentHandlers)[number]["text"]>>[0];

class NameHandler {
    context: UserScrapeContext;
    buffer: string;

    constructor(context: UserScrapeContext) {
        this.context = context;
        this.buffer = "";
    }

    // Get the text within the link element.
    text(textChunk: TextChunk) {
        this.buffer += textChunk.text;
        if (textChunk.lastInTextNode) {
            this.context.names.push(this.buffer.trim());
            this.buffer = "";
        }
    }

    // Get the href attribute of the link element.
    element(element: Element) {
        const href = element.getAttribute("href");
        if (!href) return;

        const match = href.match(userIDRegex)?.[1];
        if (!match) return; // There are multiple links per profile, but we only want the /profiles/ one.

        this.context.userIds.push(match);
    }
}

class AvatarHandler {
    context: UserScrapeContext;

    constructor(context: UserScrapeContext) {
        this.context = context;
    }

    element(element: Element) {
        const src = element.getAttribute("src") || "";
        this.context.avatarUrls.push(src);
    }
}

class SessionIDHandler {
    context: SessionIDContext;

    constructor(context: SessionIDContext) {
        this.context = context;
    }

    text(element: TextChunk) {
        const match = element.text.match(sessionIDRegex)?.[1];
        if (!match) return;
        this.context.sessionID = match;
    }
}

class CountHandler {
    context: UserScrapeContext;

    constructor(context: UserScrapeContext) {
        this.context = context;
    }

    text(element: TextChunk) {
        const match = element.text.match(countRegex)?.[1];
        if (!match) return;
        this.context.count = Number.parseInt(match, 10);
    }
}

export async function searchSteamCommunityUsers(text: string, page = 1) {
    // Step 1: Fetch the main user search page to retrieve the session id.
    const sessionID = await getSessionID();

    // Step 2: Fetch the AJAX search results.
    const searchUrl = new URL("https://steamcommunity.com/search/SearchCommunityAjax");
    searchUrl.searchParams.set("text", text);
    searchUrl.searchParams.set("filter", "users");
    searchUrl.searchParams.set("sessionid", sessionID);
    searchUrl.searchParams.set("steamid_user", "false");
    searchUrl.searchParams.set("page", page.toString());

    // Need to include session ID in both URL and headers I guess
    const ajaxResponse = await fetch(searchUrl, {
        headers: {
            cookie: `sessionid=${sessionID}`,
        },
    });
    if (!ajaxResponse.ok) {
        throw new Error(`Failed to fetch search results: ${ajaxResponse.statusText}`);
    }
    const result = await ajaxResponse.json();
    if (!result.success) {
        throw new Error("Search result unsuccessful");
    }
    const htmlContent = unescapeHTML(result.html);

    const context: UserScrapeContext = {
        names: [],
        userIds: [],
        avatarUrls: [],
        count: 0,
    };

    const HTMLRewriterConstructor = await getHTMLRewriter();
    // Create a Response object from the HTML string.
    const htmlResponse = new Response(htmlContent);

    await new HTMLRewriterConstructor()
        .on("a.searchPersonaName", new NameHandler(context))
        .on("div.mediumHolder_default img", new AvatarHandler(context))
        .on("span.community_searchresults_paging", new CountHandler(context))
        .transform(htmlResponse)
        .text();

    // Build and return the users array assuming order consistency.
    const users: User[] = [];
    const count = context.names.length;
    for (let i = 0; i < count; i++) {
        users.push({
            name: unescapeHTML(context.names[i] || ""),
            userId: context.userIds[i] || "",
            avatarUrl: context.avatarUrls[i] || "",
        });
    }
    return {
        users,
        total: context.count,
    };
}

export async function getSessionID() {
    const mainPageResponse = await fetch("https://steamcommunity.com/search/users/");
    if (!mainPageResponse.ok) throw new Error(`Failed to load main page: ${mainPageResponse.statusText}`);

    const HTMLRewriterConstructor = await getHTMLRewriter();
    const context: SessionIDContext = {
        sessionID: "",
    };
    const htmlResponse = new Response(await mainPageResponse.text());
    await new HTMLRewriterConstructor()
        .on('script[type="text/javascript"]', new SessionIDHandler(context))
        .transform(htmlResponse)
        .text();
    if (!context.sessionID) throw new Error("Session ID not found");
    return context.sessionID;
}

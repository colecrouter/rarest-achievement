import type { SteamAppAchievement, SteamUserAchievement } from "@models";
import { Attempt } from "../../../error";
import type { LanguageCode } from "../../../lang";
import { unescapeHTML } from "../utils";
import { YouTubeClient } from "./client";

const proompt = `
Take be given two sets of data. The first one indicates source material (video game achievements), and the second indicates a list of video search results. For each result, you must indicate which results are relevant *guides*. Relevant results must also reference the name of the achievement or a match a sufficient portion of the description. Your output will be parsed, so please **do not include any additional text or formatting.** Do not omit results based on language.

# Output Format

A simple JSON array of booleans, corresponding to the videos in the order supplied, e.g. if the first video is relevant, the second is not, and the third is relevant, you would output:

\`\`\`
[ true, false, true ]
\`\`\`
`;

export class YouTubeRepository {
    #client: YouTubeClient;
    #cache: KVNamespace;
    #ai: Ai;

    constructor(apiKey: string, cache: KVNamespace, ai: Ai) {
        this.#client = new YouTubeClient(apiKey);
        this.#cache = cache;
        this.#ai = ai;
    }

    async searchGuides(achievement: SteamAppAchievement | SteamUserAchievement, locale: LanguageCode) {
        const cacheKey = `youtube:${achievement.app.id}:${achievement.id}:${locale}`;
        const cached = await this.#cache.get(cacheKey);
        if (cached) {
            const { data, error } = JSON.parse(cached) as {
                data: YouTubeGuide[];
                error: string | null;
            };
            return Attempt.fromSimple(data, error ? new Error(error) : null);
        }

        const guides = await Attempt.try(async () => {
            const guides = await this.#client.fetchVideos(achievement, locale, 5);
            const data = guides.items.map((item) => ({
                title: unescapeHTML(item.snippet.title),
                channel: unescapeHTML(item.snippet.channelTitle),
                description: unescapeHTML(item.snippet.description),
                publishedAt: item.snippet.publishedAt,
                videoId: item.id.kind === "youtube#video" ? item.id.videoId : "",
            })) satisfies YouTubeGuide[];

            // Use AI to filter results
            const source = {
                app: achievement.app.name,
                achievement: achievement.name,
            };
            const searchResults = data.map((item) => ({
                title: item.title,
            }));
            const messages = [
                {
                    role: "system",
                    content: proompt,
                },
                {
                    role: "user",
                    content: `Source:\n\`\`\`${JSON.stringify(source)}\`\`\`\n\nSearch results:\n\`\`\`${JSON.stringify(searchResults)}\`\`\``,
                },
            ] satisfies RoleScopedChatInput[];

            console.time("AI relevance determination");

            // Use the AI to determine relevance
            const { response: aiResponse } = await this.#ai.run("@cf/google/gemma-3-12b-it", {
                messages,
                guided_json: {
                    type: "array",
                    items: {
                        type: "boolean",
                    },
                },
            });

            console.timeEnd("AI relevance determination");

            const relevance = JSON.parse(aiResponse) as unknown;

            // Validate the AI response
            if (
                !Array.isArray(relevance) ||
                !relevance.every((item) => typeof item === "boolean") ||
                relevance.length !== data.length
            ) {
                throw new Error("AI response is not a valid boolean array");
            }

            // Filter
            return data.filter((_, index) => relevance[index]);
        });

        await this.#cache.put(cacheKey, JSON.stringify({ data: guides.data, error: guides.error?.message }), {
            expirationTtl: 60 * 60 * 24,
        }); // Cache for 24 hours

        return guides;
    }
}

export interface YouTubeGuide {
    title: string;
    channel: string;
    description: string;
    publishedAt: string;
    videoId: string;
}

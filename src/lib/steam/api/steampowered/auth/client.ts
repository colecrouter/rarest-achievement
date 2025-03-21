import type { Language } from "$lib/steam/api/lang";
import type { GetFriendsListQuery, GetFriendsListResponse } from "$lib/steam/api/steampowered/auth/friends";
import type {
    GetPlayerAchievementsQuery,
    GetPlayerAchievementsResponse,
} from "$lib/steam/api/steampowered/auth/playerAchievement";
import type { GetPlayerSummariesResponse } from "$lib/steam/api/steampowered/auth/playerSummary";
import type { GetSchemaForGameQuery, GetSchemaForGameResponse } from "$lib/steam/api/steampowered/auth/schemaForGame";
import type { GetUserStatsForGameQuery, GetUserStatsForGameResponse } from "$lib/steam/api/steampowered/auth/stats";
import type {
    GetGlobalAchievementPercentagesForAppQuery,
    GetGlobalAchievementPercentagesForAppResponse,
} from "$lib/steam/api/steampowered/unauth/globalAchevement";

export class SteamAuthenticatedAPIClient {
    #key;

    constructor(key: string) {
        this.#key = key;
    }

    async getFriendsList(options: GetFriendsListQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUser/GetFriendList/v1");
        url.searchParams.set("key", this.#key);
        applyOptions(url, options);

        const response = await fetch(url);

        return (await response.json()) as GetFriendsListResponse;
    }

    async getGlobalAchievementPercentagesForApp(options: GetGlobalAchievementPercentagesForAppQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2");
        url.searchParams.set("key", this.#key);
        applyOptions(url, options);

        const response = await fetch(url);

        return (await response.json()) as GetGlobalAchievementPercentagesForAppResponse;
    }

    async getPlayerAchievements<T extends Language | undefined>(options: GetPlayerAchievementsQuery<T>) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1");
        url.searchParams.set("key", this.#key);
        applyOptions(url, options);

        const response = await fetch(url);

        return (await response.json()) as GetPlayerAchievementsResponse<T>;
    }

    async getPlayerSummaries(steamids: string[]) {
        const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2");
        url.searchParams.set("key", this.#key);
        url.searchParams.set("steamids", steamids.join(","));

        console.log(url.toString());

        const response = await fetch(url);

        return (await response.json()) as GetPlayerSummariesResponse;
    }

    async getUserStatsForGame<T extends Language | undefined>(options: GetUserStatsForGameQuery<T>) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2");
        url.searchParams.set("key", this.#key);
        applyOptions(url, options);

        const response = await fetch(url);

        return (await response.json()) as GetUserStatsForGameResponse; // I'm not sure where the generic goes
    }

    async getSchemaForGame(appId: number) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2");
        url.searchParams.set("key", this.#key);
        url.searchParams.set("appid", String(appId));

        const response = await fetch(url);

        return (await response.json()) as GetSchemaForGameResponse;
    }
}

function applyOptions(url: URL, options: Record<string, string | number | undefined>) {
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    }
}

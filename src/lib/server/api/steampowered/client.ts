import { BaseSteamAPIClient } from "$lib/server/api/baseClient";
import type { Language } from "$lib/server/api/lang";
import type { GetFriendsListQuery, GetFriendsListResponse } from "$lib/server/api/steampowered/friends";
import type {
    GetPlayerAchievementsQuery,
    GetPlayerAchievementsResponse,
} from "$lib/server/api/steampowered/playerAchievement";
import type { GetPlayerSummariesResponse } from "$lib/server/api/steampowered/playerSummary";
import type { GetSchemaForGameQuery, GetSchemaForGameResponse } from "$lib/server/api/steampowered/schemaForGame";
import type { GetUserStatsForGameQuery, GetUserStatsForGameResponse } from "$lib/server/api/steampowered/stats";
import type {
    GetGlobalAchievementPercentagesForAppQuery,
    GetGlobalAchievementPercentagesForAppResponse,
} from "$lib/server/api/steampowered/globalAchevement";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "$lib/server/api/steampowered/owned";

export class SteamAuthenticatedAPIClient extends BaseSteamAPIClient {
    #key: string;

    constructor(key: string) {
        super();
        this.#key = key;
    }

    async getFriendsList(options: GetFriendsListQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUser/GetFriendList/v1");
        url.searchParams.set("key", this.#key);
        this.applyOptions(url, options);
        return this.fetchJSON<GetFriendsListResponse>(url, "1h");
    }

    async getGlobalAchievementPercentagesForApp(options: GetGlobalAchievementPercentagesForAppQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2");
        this.applyOptions(url, options);
        return this.fetchJSON<GetGlobalAchievementPercentagesForAppResponse>(url, "1w");
    }

    async getPlayerAchievements<T extends Language | undefined>(options: GetPlayerAchievementsQuery<T>) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1");
        url.searchParams.set("key", this.#key);
        this.applyOptions(url, options);
        return this.fetchJSON<GetPlayerAchievementsResponse<T>>(url, "1d");
    }

    async getPlayerSummaries(steamids: string[]) {
        const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2");
        url.searchParams.set("key", this.#key);
        url.searchParams.set("steamids", steamids.join(","));
        return this.fetchJSON<GetPlayerSummariesResponse>(url, "1d");
    }

    async getUserStatsForGame(options: GetUserStatsForGameQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2");
        url.searchParams.set("key", this.#key);
        this.applyOptions(url, options);
        return this.fetchJSON<GetUserStatsForGameResponse>(url, "1h");
    }

    async getSchemaForGame(options: GetSchemaForGameQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2");
        url.searchParams.set("key", this.#key);
        this.applyOptions(url, options);
        return this.fetchJSON<GetSchemaForGameResponse>(url, "1w");
    }

    async getOwnedGames<T extends boolean>(options: GetOwnedGamesQuery<T>) {
        const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1");
        url.searchParams.set("key", this.#key);
        this.applyOptions(url, options);
        return this.fetchJSON<GetOwnedGamesResponse<T>>(url, "1d");
    }
}

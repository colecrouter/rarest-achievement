import type { GetFriendsListQuery, GetFriendsListResponse } from "../../api/steampowered/friends";
import { BaseSteamAPIClient } from "../baseClient";
import type { Language } from "../lang";
import type {
    GetGlobalAchievementPercentagesForAppQuery,
    GetGlobalAchievementPercentagesForAppResponse,
} from "./globalAchevement";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "./owned";
import type { GetPlayerAchievementsQuery, GetPlayerAchievementsResponse } from "./playerAchievement";
import type { GetPlayerSummariesResponse } from "./playerSummary";
import type { GetSchemaForGameQuery, GetSchemaForGameResponse } from "./schemaForGame";
import type { GetUserStatsForGameQuery, GetUserStatsForGameResponse } from "./stats";

export class SteamAuthenticatedAPIClient extends BaseSteamAPIClient {
    #key: string;

    constructor(key: string) {
        super();
        this.#key = key;
    }

    /**
     * Success: 200 - {friendslist: {friends: [...]}}
     * Private: 200 - {friendslist: {friends: []}} (weird lol)
     */
    async getFriendsList(options: GetFriendsListQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUser/GetFriendList/v1");
        url.searchParams.set("key", this.#key);
        SteamAuthenticatedAPIClient.applyOptions(url, options);
        return SteamAuthenticatedAPIClient.fetchJSON<GetFriendsListResponse, false>(url, false);
    }

    /**
     * Success: 200 - {achievementpercentages: {achievements: [{"name":"TF_SCOUT_LONG_DISTANCE_RUNNER","percent":"50.8"}]}}
     * Missing: 403 - {}
     */
    async getGlobalAchievementPercentagesForApp(options: GetGlobalAchievementPercentagesForAppQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2");
        SteamAuthenticatedAPIClient.applyOptions(url, options);
        return SteamAuthenticatedAPIClient.fetchJSON<GetGlobalAchievementPercentagesForAppResponse, true>(url, true);
    }

    /**
     * Success: 200 - {playerstats: {success: true, steamID: "76561198000000000", gameName: "GameName", achievements: [{apiname: "AchievementName", achieved: 1, unlocktime: 1234567890}]}}
     * Private: 403 - {playerstats: {success: false, error: "Profile is not public"}}
     * Missing: 403 - {playerstats: {success: false, error:"Invalid SteamID"}}}
     */
    async getPlayerAchievements<T extends Language | undefined>(options: GetPlayerAchievementsQuery<T>) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1");
        url.searchParams.set("key", this.#key);
        SteamAuthenticatedAPIClient.applyOptions(url, options);
        return SteamAuthenticatedAPIClient.fetchJSON<GetPlayerAchievementsResponse<T>, true>(url, true);
    }

    /**
     * Success: 200 - {response: {players: [{steamid: "76561198000000000", personaname: "PlayerName"}]}}
     * Missing: 200 - {response: {players: []}}
     */
    async getPlayerSummaries(steamids: string[]) {
        const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2");
        url.searchParams.set("key", this.#key);
        url.searchParams.set("steamids", steamids.join(","));
        return SteamAuthenticatedAPIClient.fetchJSON<GetPlayerSummariesResponse, false>(url, false);
    }

    /**
     * Success: 200 - {playerstats: {steamID: "76561198000000000", gameName: "GameName", achievements: [{apiname: "AchievementName", achieved: 1, unlocktime: 1234567890}]}}
     * Missing: 403 - {}
     */
    async getUserStatsForGame(options: GetUserStatsForGameQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2");
        url.searchParams.set("key", this.#key);
        SteamAuthenticatedAPIClient.applyOptions(url, options);
        return SteamAuthenticatedAPIClient.fetchJSON<GetUserStatsForGameResponse, true>(url, true);
    }

    /**
     * Success: 200 - {game: {gameName: "GameName"}}
     * Missing: 403 - {game:{}}
     */
    async getSchemaForGame(options: GetSchemaForGameQuery) {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2");
        url.searchParams.set("key", this.#key);
        SteamAuthenticatedAPIClient.applyOptions(url, options);
        return SteamAuthenticatedAPIClient.fetchJSON<GetSchemaForGameResponse, true>(url, true);
    }

    /**
     * Success: 200 - {response: {game_count: 1, games: [{appid: 123456, name: "GameName", playtime_forever: 120}]}}
     * Missing: 400 - No actual response, just plain text "Bad Request"
     * Private: 200 - {response: {}}
     */
    async getOwnedGames<T extends boolean = false>(options: GetOwnedGamesQuery<T>) {
        const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1");
        url.searchParams.set("key", this.#key);
        SteamAuthenticatedAPIClient.applyOptions(url, options);
        return SteamAuthenticatedAPIClient.fetchJSON<GetOwnedGamesResponse<T>, true>(url, true);
    }
}

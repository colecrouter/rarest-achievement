// Centralized fixtures and minimal mock client for SteamAuthenticatedAPI

import type { APILanguageCode } from "../../src/lang";
import type { SteamAuthenticatedAPI } from "../../src/repositories/api/steampowered/client";
import type { GetFriendsListQuery, GetFriendsListResponse } from "../../src/repositories/api/steampowered/friends";
import type {
	GetGlobalAchievementPercentagesForAppQuery,
	GetGlobalAchievementPercentagesForAppResponse,
} from "../../src/repositories/api/steampowered/globalAchevement";
import type { GetOwnedGamesQuery, GetOwnedGamesResponse } from "../../src/repositories/api/steampowered/owned";
import type {
	GetPlayerAchievementsQuery,
	GetPlayerAchievementsResponse,
} from "../../src/repositories/api/steampowered/playerAchievement";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";
import type {
	GetSchemaForGameQuery,
	GetSchemaForGameResponse,
} from "../../src/repositories/api/steampowered/schemaForGame";
import type {
	GetUserStatsForGameQuery,
	GetUserStatsForGameResponse,
} from "../../src/repositories/api/steampowered/stats";

export class MockSteamAuthenticatedAPIClient implements SteamAuthenticatedAPI {
	// internal stores for fixture responses
	private friendsList = new Map<string, GetFriendsListResponse>();
	private globalAchievements = new Map<number, GetGlobalAchievementPercentagesForAppResponse | null>();
	private playerAchievements = new Map<string, unknown>();
	private playerSummaries = new Map<string, GetPlayerSummariesResponse["response"]["players"][number]>();
	private userStats = new Map<string, GetUserStatsForGameResponse | null>();
	private schemaForGame = new Map<string, GetSchemaForGameResponse | null>();
	private ownedGames = new Map<string, unknown>();

	/**
	 * Set the response for getFriendsList for given options
	 */
	setFriendsList(options: GetFriendsListQuery, response: GetFriendsListResponse) {
		this.friendsList.set(JSON.stringify(options), response);
	}
	async getFriendsList(options: GetFriendsListQuery): Promise<GetFriendsListResponse> {
		const key = JSON.stringify(options);
		const result = this.friendsList.get(key);
		if (!result) throw new Error(`No mock friendsList for options: ${key}`);
		return result;
	}

	/**
	 * Set the response for getGlobalAchievementPercentagesForApp for given appid
	 */
	setGlobalAchievementPercentagesForApp(
		appid: number,
		response: GetGlobalAchievementPercentagesForAppResponse | null,
	) {
		this.globalAchievements.set(appid, response);
	}
	async getGlobalAchievementPercentagesForApp(
		options: GetGlobalAchievementPercentagesForAppQuery,
	): Promise<GetGlobalAchievementPercentagesForAppResponse | null> {
		return this.globalAchievements.get(options.gameid) ?? null;
	}

	/**
	 * Set the response for getPlayerAchievements for given options
	 */
	setPlayerAchievements<T extends APILanguageCode | undefined>(
		options: GetPlayerAchievementsQuery<T>,
		response: GetPlayerAchievementsResponse<T> | null,
	) {
		this.playerAchievements.set(JSON.stringify(options), response);
	}
	async getPlayerAchievements<T extends APILanguageCode | undefined>(
		options: GetPlayerAchievementsQuery<T>,
	): Promise<GetPlayerAchievementsResponse<T> | null> {
		const key = JSON.stringify(options);
		const result = this.playerAchievements.get(key) as GetPlayerAchievementsResponse<T> | undefined;
		return result ?? null;
	}

	/**
	 * Set the response for getPlayerSummaries for given steamids
	 */
	setPlayerSummaries(steamids: string[], response: GetPlayerSummariesResponse) {
		// Index by individual id to support any ordering/batching in requests
		for (const player of response.response.players) {
			this.playerSummaries.set(player.steamid, player);
		}
	}
	async getPlayerSummaries(steamids: string[]): Promise<GetPlayerSummariesResponse> {
		// Build response from per-id index to tolerate different orders/chunking
		const players: GetPlayerSummariesResponse["response"]["players"] = [];
		const missing: string[] = [];
		for (const id of steamids) {
			const p = this.playerSummaries.get(id);
			if (p) players.push(p);
			else missing.push(id);
		}
		if (missing.length > 0) {
			throw new Error(`No mock playerSummaries for steamids: ${missing.join(",")}`);
		}
		return { response: { players } };
	}

	/**
	 * Set the response for getUserStatsForGame for given options
	 */
	setUserStatsForGame(options: GetUserStatsForGameQuery, response: GetUserStatsForGameResponse | null) {
		this.userStats.set(JSON.stringify(options), response);
	}
	async getUserStatsForGame(options: GetUserStatsForGameQuery): Promise<GetUserStatsForGameResponse | null> {
		return this.userStats.get(JSON.stringify(options)) ?? null;
	}

	/**
	 * Set the response for getSchemaForGame for given options
	 */
	setSchemaForGame(options: GetSchemaForGameQuery, response: GetSchemaForGameResponse | null) {
		this.schemaForGame.set(JSON.stringify(options), response);
	}
	async getSchemaForGame(options: GetSchemaForGameQuery): Promise<GetSchemaForGameResponse | null> {
		return this.schemaForGame.get(JSON.stringify(options)) ?? null;
	}

	/**
	 * Set the response for getOwnedGames for given options
	 */
	setOwnedGames<T extends boolean>(options: GetOwnedGamesQuery<T>, response: GetOwnedGamesResponse<T> | null) {
		this.ownedGames.set(JSON.stringify(options), response);
	}
	async getOwnedGames<T extends boolean = false>(
		options: GetOwnedGamesQuery<T>,
	): Promise<GetOwnedGamesResponse<T> | null> {
		const key = JSON.stringify(options);
		const result = this.ownedGames.get(key) as GetOwnedGamesResponse<T> | undefined;
		return result ?? null;
	}
}

// Centralized fixtures and minimal type helpers for AppRepository tests

import type { SteamStoreAPI } from "../../src";
import type { AppDetailsData, GetAppDetailsResponse } from "../../src/repositories/api/store/appdetails";
import type { GetAppReviewsResponse } from "../../src/repositories/api/store/appreviews";
import type { SearchAppsResponse } from "../../src/repositories/api/store/searchapps";

export class MockSteamStoreAPIClient implements SteamStoreAPI {
	// internal stores for fixture responses
	private appDetails = new Map<number, GetAppDetailsResponse>();
	private appReviews = new Map<number, GetAppReviewsResponse>();
	private searchResults = new Map<string, SearchAppsResponse>();

	/**
	 * Sets the response for getAppDetails for a given app id
	 */
	setAppDetails(app: number, response: GetAppDetailsResponse) {
		this.appDetails.set(app, response as GetAppDetailsResponse);
	}

	async getAppDetails<T extends Array<keyof AppDetailsData> | undefined>(
		app: number,
		// Accept and ignore options to match production signature
		_opts?: unknown,
	): Promise<GetAppDetailsResponse<T>> {
		// Return a safe default keyed response when not pre-seeded to avoid runtime errors
		const existing = this.appDetails.get(app) as GetAppDetailsResponse<T> | undefined;
		if (existing) return existing;
		// Default to an object with a null data payload; production code tolerates null and skips estimation
		// success must be the literal 1 in production API, but our type uses `true` in tests elsewhere.
		// Use the same shape as seeded responses with data: null.
		return {
			[app]: { success: true as const, data: null as unknown as AppDetailsData },
		} as GetAppDetailsResponse<T>;
	}

	/**
	 * Sets the response for getAppReviews for a given app id
	 */
	setAppReviews(app: number, response: GetAppReviewsResponse) {
		this.appReviews.set(app, response);
	}

	async getAppReviews(app: number): Promise<GetAppReviewsResponse | null> {
		const existing = this.appReviews.get(app);
		if (existing) return existing;
		// Provide a minimal, valid default summary so estimation can proceed without emitting test warnings.
		return {
			success: 1,
			query_summary: {
				num_reviews: 0,
				review_score: 0,
				review_score_desc: "",
				total_positive: 0,
				total_negative: 0,
				total_reviews: 0,
			},
			reviews: [],
			cursor: "*",
		} satisfies GetAppReviewsResponse;
	}

	/**
	 * Sets the response for searchApps for a given query
	 */
	setSearchApps(query: string, response: SearchAppsResponse) {
		this.searchResults.set(query, response);
	}

	async searchApps(query: string): Promise<SearchAppsResponse> {
		return this.searchResults.get(query) || [];
	}
}

// // Shared base used to craft valid AppDetailsData rows
// export const appDataBase: Omit<AppDetailsData, "name" | "steam_appid"> = {
//     type: "game",
//     required_age: 0,
//     is_free: false,
//     price_overview: { final: 0 },
//     release_date: { coming_soon: false, date: "Jan 1, 2020" },
// };

// // High-level store fixtures used by AppRepository ensure/upsert flows
// export const fixtureAppEn = { appid: 999001, name: "Test App EN" };
// export const fixtureAppFr = { appid: 999001, name: "Test App FR" };

// // Helper factory for constructing schema-compatible app rows quickly
// export function makeAppData(steam_appid: number, name: string): AppDetailsData {
//     return { ...appDataBase, steam_appid, name };
// }

// Centralized fixtures and minimal type helpers for AppRepository tests

import type { SteamStoreAPI } from "../../src";
import type {
	AppDetailsData,
	GetAppDetailsQuery,
	GetAppDetailsResponse,
} from "../../src/repositories/api/store/appdetails";
import type { GetAppReviewsQuery, GetAppReviewsResponse } from "../../src/repositories/api/store/appreviews";
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
		options?: Omit<GetAppDetailsQuery<T>, "appids">,
	): Promise<GetAppDetailsResponse<T>> {
		return this.appDetails.get(app) as GetAppDetailsResponse<T>;
	}

	/**
	 * Sets the response for getAppReviews for a given app id
	 */
	setAppReviews(app: number, response: GetAppReviewsResponse) {
		this.appReviews.set(app, response);
	}

	async getAppReviews(
		app: number,
		options?: Omit<GetAppReviewsQuery, "json">,
	): Promise<GetAppReviewsResponse | null> {
		return this.appReviews.get(app) || null;
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

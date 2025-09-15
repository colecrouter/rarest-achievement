import { BaseSteamAPIClient } from "../../api/baseClient";
import type { AppDetailsData, GetAppDetailsQuery, GetAppDetailsResponse } from "./appdetails";
import type { GetAppReviewsQuery, GetAppReviewsResponse } from "./appreviews";
import type { SearchAppsResponse } from "./searchapps";

export interface SteamStoreAPI {
	getAppDetails<T extends Array<keyof AppDetailsData> | undefined>(
		app: number,
		options?: Omit<GetAppDetailsQuery<T>, "appids">,
	): Promise<GetAppDetailsResponse<T>>;
	getAppReviews(app: number, options?: Omit<GetAppReviewsQuery, "json">): Promise<GetAppReviewsResponse | null>;
	searchApps(query: string): Promise<SearchAppsResponse>;
}

class SteamStoreAPIClient extends BaseSteamAPIClient implements SteamStoreAPI {
	/**
	 * Success: 200 - {success: true, data: {...}}
	 * Failure: 200 - {success: false}
	 */
	async getAppDetails<T extends Array<keyof AppDetailsData> | undefined>(
		app: number,
		options?: Omit<GetAppDetailsQuery<T>, "appids">,
	) {
		const url = new URL("https://store.steampowered.com/api/appdetails");
		if (options) {
			SteamStoreAPIClient.applyOptions(url, options);
		}
		url.searchParams.set("appids", app.toString());
		return SteamStoreAPIClient.fetchJSON<GetAppDetailsResponse<T>, false>(url, false);
	}

	/**
	 * Success: 200 - {success: 1, query_summary: {...}}
	 * Failure: 200 - {success: 1; query_summary: {...}}
	 */
	async getAppReviews(app: number, options?: Omit<GetAppReviewsQuery, "json">) {
		const url = new URL(`https://store.steampowered.com/appreviews/${app}`);
		if (options) {
			SteamStoreAPIClient.applyOptions(url, options);
		}
		url.searchParams.set("json", "1");
		return SteamStoreAPIClient.fetchJSON<GetAppReviewsResponse, false>(url, false);
	}

	/**
	 * Always returns 200 - []
	 */
	async searchApps(query: string): Promise<SearchAppsResponse> {
		const url = new URL(`https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`);
		return SteamStoreAPIClient.fetchJSON<SearchAppsResponse, false>(url, false);
	}
}

const client = new SteamStoreAPIClient();

export { client as SteamStoreAPIClient };

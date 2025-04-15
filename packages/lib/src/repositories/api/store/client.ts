import { BaseSteamAPIClient } from "../../api/baseClient";
import type { AppDetailsData, GetAppDetailsQuery, GetAppDetailsResponse } from "./appdetails";
import type { GetAppReviewsQuery, GetAppReviewsResponse } from "./appreviews";

export class SteamStoreAPIClient extends BaseSteamAPIClient {
    /**
     * Success: 200 - {success: true, data: {...}}
     * Failure: 200 - {success: false}
     */
    static async getAppDetails<T extends Array<keyof AppDetailsData> | undefined>(
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
    static async getAppReviews(app: number, options?: Omit<GetAppReviewsQuery, "json">) {
        const url = new URL(`https://store.steampowered.com/appreviews/${app}`);
        if (options) {
            SteamStoreAPIClient.applyOptions(url, options);
        }
        url.searchParams.set("json", "1");
        return SteamStoreAPIClient.fetchJSON<GetAppReviewsResponse, false>(url, false);
    }
}

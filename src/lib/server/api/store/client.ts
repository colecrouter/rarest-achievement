import { BaseSteamAPIClient } from "$lib/server/api/baseClient";
import type { AppDetailsData, GetAppDetailsQuery, GetAppDetailsResponse } from "$lib/server/api/store/appdetails";

export class SteamStoreAPIClient extends BaseSteamAPIClient {
    async getAppDetails<T extends Array<keyof AppDetailsData> | undefined>(
        app: number,
        options?: Omit<GetAppDetailsQuery<T>, "appids">,
    ) {
        const url = new URL("https://store.steampowered.com/api/appdetails");
        if (options) {
            this.applyOptions(url, options);
        }
        url.searchParams.set("appids", app.toString());
        return this.fetchJSON<GetAppDetailsResponse<T>>(url, "1mo");
    }
}

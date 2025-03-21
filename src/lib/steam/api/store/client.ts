import type { GetAppDetailsQuery, GetAppDetailsResponse } from "$lib/steam/api/store/appdetails";

export class SteamStoreAPIClient {
    async getAppDetails(apps: number[], options?: Omit<GetAppDetailsQuery, "appids">) {
        const url = new URL("https://store.steampowered.com/api/appdetails");
        options && applyOptions(url, options);
        url.searchParams.set("appids", apps.join(","));

        const response = await fetch(url.href);

        return (await response.json()) as GetAppDetailsResponse;
    }
}

function applyOptions(url: URL, options: Record<string, string | number | undefined>) {
    for (const [key, value] of Object.entries(options)) {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    }
}

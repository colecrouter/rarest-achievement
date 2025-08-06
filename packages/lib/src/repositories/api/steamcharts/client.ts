import { BaseSteamAPIClient } from "../baseClient";
import type { GetAppChartDataResponse } from "./types";

export interface SteamChartsAPI {
    getAppChartData(app: number): Promise<GetAppChartDataResponse | null>;
}
class SteamChartsAPIClient extends BaseSteamAPIClient implements SteamChartsAPI {
    async getAppChartData(app: number) {
        const url = new URL(`https://steamcharts.com/app/${app}/chart-data.json`);
        return SteamChartsAPIClient.fetchJSON<GetAppChartDataResponse, true>(url, true);
    }
}

const client = new SteamChartsAPIClient();

export { client as SteamChartsAPIClient };

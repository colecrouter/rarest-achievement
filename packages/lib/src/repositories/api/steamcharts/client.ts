import { BaseSteamAPIClient } from "../baseClient";
import type { GetAppChartDataResponse } from "./types";

export class SteamChartsAPIClient extends BaseSteamAPIClient {
    static async getAppChartData(app: number) {
        const url = new URL(`https://steamcharts.com/app/${app}/chart-data.json`);
        return SteamChartsAPIClient.fetchJSON<GetAppChartDataResponse, true>(url, true);
    }
}

// Centralized fixture for SteamChartsAPI

import type { SteamChartsAPI } from "../../src/repositories/api/steamcharts/client";
import type { GetAppChartDataResponse } from "../../src/repositories/api/steamcharts/types";

export class MockSteamChartsAPIClient implements SteamChartsAPI {
    private chartData = new Map<number, GetAppChartDataResponse | null>();

    /**
     * Set fixture for getAppChartData
     */
    setAppChartData(app: number, response: GetAppChartDataResponse | null) {
        this.chartData.set(app, response);
    }

    async getAppChartData(app: number): Promise<GetAppChartDataResponse | null> {
        return this.chartData.get(app) ?? null;
    }
}

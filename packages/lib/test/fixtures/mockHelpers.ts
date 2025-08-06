import type { MockSteamAuthenticatedAPIClient } from "../mocks/steamAuthenticated";
import type { MockSteamStoreAPIClient } from "../mocks/steamStore";
import { MockSteamChartsAPIClient } from "../mocks/steamCharts";
import { MockSteamAuthenticatedAPIClient as MockAuthClass } from "../mocks/steamAuthenticated";
import { MockSteamStoreAPIClient as MockStoreClass } from "../mocks/steamStore";
import { AppRepository } from "../../src/repositories/sqlite/App";
import type { APILanguageCode } from "../../src/lang";
import type { GetSchemaForGameResponse } from "../../src/repositories/api/steampowered/schemaForGame";
import type { GetAppDetailsResponse } from "../../src/repositories/api/store/appdetails";
import type { ProjectDB } from "../../src/repositories/sqlite/schema";

// Global mock instances for convenience
let authMock: MockSteamAuthenticatedAPIClient | null = null;
let storeMock: MockSteamStoreAPIClient | null = null;

/**
 * Set the global mock instances (should be called from test setup)
 */
export function setMockInstances(auth: MockSteamAuthenticatedAPIClient, store: MockSteamStoreAPIClient) {
    authMock = auth;
    storeMock = store;
}

/**
 * Clear all mock responses
 */
export function clearMocks() {
    // Mock classes don't have clear methods yet, but this is where we'd call them
    // For now, this is just a placeholder
}

/**
 * Set a mock response for various API endpoints
 */
export function setMockResponse(
    endpoint: "getAppDetails",
    appid: number,
    lang: string,
    response: { appid: number; name: string },
): void;
export function setMockResponse(
    endpoint: "getSchemaForGame",
    appid: number,
    lang: string,
    response: GetSchemaForGameResponse,
): void;
export function setMockResponse(endpoint: string, appid: number, lang: string, response: unknown) {
    const apiLang = mapTestLangToAPILang(lang);

    switch (endpoint) {
        case "getAppDetails": {
            if (!storeMock) throw new Error("Store mock not initialized. Call setMockInstances first.");
            // Convert simple fixture to proper API response format
            const appResponse = response as { appid: number; name: string };
            const apiResponse: GetAppDetailsResponse = {
                [appid]: {
                    success: true,
                    data: {
                        steam_appid: appResponse.appid,
                        name: appResponse.name,
                        // Add minimal required fields
                        type: "game",
                        required_age: 0,
                        is_free: false,
                        detailed_description: "Test",
                        about_the_game: "Test",
                        short_description: "Test",
                        supported_languages: "English",
                        header_image: "https://example.com/header.jpg",
                        website: "https://example.com",
                        pc_requirements: { minimum: "Windows 10" },
                        mac_requirements: { minimum: "macOS 10.10" },
                        linux_requirements: { minimum: "Ubuntu 16.04" },
                        legal_notice: "",
                        developers: ["Test Developer"],
                        publishers: ["Test Publisher"],
                        packages: [],
                        package_groups: [],
                        platforms: { windows: true, mac: false, linux: false },
                        categories: [],
                        genres: [],
                        screenshots: [],
                        movies: [],
                        release_date: { coming_soon: false, date: "Jan 1, 2020" },
                        support_info: { url: "https://example.com", email: "test@example.com" },
                        background: "https://example.com/background.jpg",
                        content_descriptors: { ids: [], notes: "" },
                    },
                },
            };
            storeMock.setAppDetails(appid, apiResponse);
            break;
        }

        case "getSchemaForGame": {
            if (!authMock) throw new Error("Auth mock not initialized. Call setMockInstances first.");
            authMock.setSchemaForGame({ appid, l: apiLang }, response as GetSchemaForGameResponse);
            break;
        }

        default:
            throw new Error(`Unknown endpoint: ${endpoint}`);
    }
}

/**
 * Create an AppRepository with all required mock dependencies
 */
export function createAppRepository(
    db: ProjectDB,
    auth?: MockSteamAuthenticatedAPIClient,
    charts?: MockSteamChartsAPIClient,
    store?: MockSteamStoreAPIClient,
) {
    // Use provided mocks first, then global instances, then create new ones
    const authMockInstance = auth || authMock || new MockAuthClass();
    const chartsMock = charts || new MockSteamChartsAPIClient();
    const storeMockInstance = store || storeMock || new MockStoreClass();

    return new AppRepository(db, authMockInstance, chartsMock, storeMockInstance);
}

/**
 * Map test language strings to API language codes
 */
function mapTestLangToAPILang(lang: string): APILanguageCode {
    switch (lang) {
        case "english":
            return "english";
        case "french":
            return "french";
        case "en":
            return "english";
        case "fr":
            return "french";
        default:
            return "english";
    }
}

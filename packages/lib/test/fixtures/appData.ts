import type { SteamAppRaw } from "../../src/models";
import type { GetSchemaForGameResponse } from "../../src/repositories/api/steampowered/schemaForGame";
import type { AppDetailsData } from "../../src/repositories/api/store/appdetails";

// Minimal base data for creating valid app records
const appDataBase = {
	type: "game",
	required_age: 0,
	is_free: false,
	detailed_description: "Test description",
	about_the_game: "Test about",
	short_description: "Test short",
	supported_languages: "English",
	header_image: "https://example.com/header.jpg",
	background: "https://example.com/background.jpg",
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
	content_descriptors: { ids: [], notes: "" },
} satisfies Omit<AppDetailsData, "name" | "steam_appid">;

/**
 * Create app data fixture for testing
 */
export function makeAppData(steam_appid: number, name: string): SteamAppRaw {
	return {
		...appDataBase,
		steam_appid,
		name,
	} as SteamAppRaw;
}

/**
 * Create achievement schema fixture for testing
 */
export function makeAchievementSchema(
	gameName: string,
	achievements: Array<{
		name: string;
		displayName: string;
		description?: string;
		defaultvalue?: number;
		hidden?: number;
		icon?: string;
		icongray?: string;
	}>,
): GetSchemaForGameResponse {
	return {
		game: {
			gameName,
			gameVersion: 1,
			availableGameStats: {
				achievements: achievements.map((ach) => ({
					name: ach.name,
					displayName: ach.displayName,
					description: ach.description || "Default description",
					defaultvalue: ach.defaultvalue || 0,
					hidden: ach.hidden || 0,
					icon: ach.icon || "icon.png",
					icongray: ach.icongray || "gray.png",
				})),
			},
		},
	};
}

// Pre-defined fixtures for common test scenarios
export const fixtureAppEn = { appid: 999001, name: "Test App EN" };
export const fixtureAppFr = { appid: 999001, name: "Test App FR" };

// Additional common app fixtures
export const portalApp = { appid: 1001, name: "Portal 2" };

// Achievement fixtures
export const basicAchievement = {
	name: "ACH1",
	displayName: "Achievement 1",
	description: "Desc",
	icon: "icon.png",
	icongray: "gray.png",
};

export const basicAchievementEn = {
	name: "ACH1",
	displayName: "Achievement 1",
	description: "Desc EN",
	icon: "icon.png",
	icongray: "gray.png",
};
export const halfLifeApp = { appid: 1002, name: "Half-Life 2" };

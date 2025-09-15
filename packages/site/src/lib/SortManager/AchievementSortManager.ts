import type {
	AppAchievementRepository,
	SteamAppAchievement,
	SteamUserAchievement,
	UserAchievementRepository,
} from "@project/lib";
import { getContext, setContext } from "svelte";
import { RepositoryClientSortManager, RepositoryServerSortManager } from "./RepositorySortManager.svelte";
import { RepositoryURLParameterParser } from "./RepositoryURLParameterParser";

type TRepository = UserAchievementRepository | AppAchievementRepository;
type TAchievementData = SteamUserAchievement | SteamAppAchievement;

// URL Parameter Parser for Achievement repositories
export class AchievementURLParameterParser extends RepositoryURLParameterParser<TRepository> {
	protected validateSortMethod(value: string): "rarity_pct" | "rarity_score" | "unlocked_at" | null {
		// Union of UserAchievementSortMethod and AppAchievementSortMethod
		const validMethods = ["rarity_pct", "rarity_score", "unlocked_at"] as const;
		// @ts-expect-error - Using type assertion for union of repository sort methods
		return validMethods.includes(value) ? value : null;
	}

	protected validateFilter(value: string): string | null {
		const validFilters = ["all", "unlocked", "locked"];
		return validFilters.includes(value) ? value : null;
	}
}

// Shared sort implementation for achievements
function sortAchievements(
	data: TAchievementData[],
	method: string,
	direction: "asc" | "desc",
	search?: string,
	filter?: string,
): TAchievementData[] {
	let filtered = data.slice();

	// Apply search filter
	if (search) {
		const searchTerm = search.toLowerCase();
		filtered = filtered.filter(
			(ach) =>
				ach.name.toLowerCase().includes(searchTerm) ||
				(ach.description?.toLowerCase() || "").includes(searchTerm) ||
				ach.app.name.toLowerCase().includes(searchTerm),
		);
	}

	// Apply filter
	if (filter !== "all") {
		switch (filter) {
			case "unlocked":
				filtered = filtered.filter((a) => "unlocked" in (a as object) && (a as SteamUserAchievement).unlocked);
				break;
			case "locked":
				filtered = filtered.filter((a) => "unlocked" in (a as object) && !(a as SteamUserAchievement).unlocked);
				break;
		}
	}

	// Apply sorting
	filtered.sort((a, b) => {
		let comparison = 0;

		switch (method) {
			case "rarity_pct":
				comparison = (a as TAchievementData).globalPercentage - (b as TAchievementData).globalPercentage;
				break;
			case "rarity_score":
				comparison = ((a as TAchievementData).globalCount || 0) - ((b as TAchievementData).globalCount || 0);
				break;
			case "unlocked_at":
				if ("unlocked" in (a as object) && "unlocked" in (b as object)) {
					const aUnlocked = (a as SteamUserAchievement).unlocked;
					const bUnlocked = (b as SteamUserAchievement).unlocked;
					const aTime = aUnlocked && typeof aUnlocked === "object" ? aUnlocked.getTime() : 0;
					const bTime = bUnlocked && typeof bUnlocked === "object" ? bUnlocked.getTime() : 0;
					comparison = aTime - bTime;
				}
				break;
			default:
				comparison = (a as TAchievementData).name.localeCompare((b as TAchievementData).name);
		}

		return direction === "desc" ? -comparison : comparison;
	});

	// Final pass: always move nullish values to the end for specific sort methods
	if (method === "rarity_score" || method === "unlocked_at") {
		filtered.sort((a, b) => {
			if (method === "rarity_score") {
				const aCount = (a as TAchievementData).globalCount;
				const bCount = (b as TAchievementData).globalCount;
				if (aCount == null && bCount == null) return 0;
				if (aCount == null) return 1;
				if (bCount == null) return -1;
				return 0; // Keep existing order for non-null values
			}

			if (method === "unlocked_at" && "unlocked" in (a as object) && "unlocked" in (b as object)) {
				const aUnlocked = (a as SteamUserAchievement).unlocked;
				const bUnlocked = (b as SteamUserAchievement).unlocked;
				if (aUnlocked == null && bUnlocked == null) return 0;
				if (aUnlocked == null) return 1;
				if (bUnlocked == null) return -1;
				return 0; // Keep existing order for non-null values
			}

			return 0;
		});
	}

	return filtered;
}

export class AchievementClientSortManager extends RepositoryClientSortManager<TRepository> {
	constructor() {
		super({
			method: "rarity_pct",
			direction: "asc",
		});
	}

	// Unified sort implementation
	sort(data: TAchievementData[]): TAchievementData[] {
		return sortAchievements(data, this.method, this.direction, this.search, this.filter);
	}
}

export class AchievementServerSortManager extends RepositoryServerSortManager<TRepository> {
	constructor() {
		super({
			method: "rarity_pct",
			direction: "asc",
		});
	}

	// TODO this actually could be used for some kind of optimistic sorting on the client side
	// That would be super cool, and I should remember to do that later

	// Unified sort implementation
	sort(data: TAchievementData[]): TAchievementData[] {
		return sortAchievements(data, this.method, this.direction, this.search, this.filter);
	}
}

// Context management
const UNIFIED_SORT_MANAGER_KEY = Symbol("UnifiedSortManager");

export function setAchievementServerSortManager() {
	return setContext(UNIFIED_SORT_MANAGER_KEY, new AchievementServerSortManager());
}

export function setAchievementClientSortManager() {
	return setContext(UNIFIED_SORT_MANAGER_KEY, new AchievementClientSortManager());
}

export function getAchievementSortManager() {
	const context = getContext<AchievementClientSortManager | AchievementServerSortManager>(UNIFIED_SORT_MANAGER_KEY);
	if (!context) throw new Error("AchievementSortManager not set in context");
	return context;
}

import type { GetOwnedGamesResponse, OwnedGame } from "../../src/repositories/api/steampowered/owned";

/**
 * Create owned game fixture for testing
 */
export function makeOwnedGame<T extends boolean = false>(appid: number, includeAppInfo: T = false as T): OwnedGame<T> {
	const base = {
		appid,
		playtime_2weeks: Math.floor(Math.random() * 1000),
		playtime_forever: Math.floor(Math.random() * 10000),
		rtime_last_played: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400 * 30), // within last 30 days
	};

	if (includeAppInfo) {
		return {
			...base,
			name: `Test Game ${appid}`,
			img_icon_url: `https://example.com/icon/${appid}.jpg`,
			img_logo_url: `https://example.com/logo/${appid}.jpg`,
			has_community_visible_stats: Math.random() > 0.5,
		} as OwnedGame<T>;
	}

	return base as OwnedGame<T>;
}

/**
 * Build a GetOwnedGamesResponse for a set of appids.
 * Optionally override specific fields per game via a map keyed by appid.
 */
export function makeOwnedGamesResponse<T extends boolean = false>(
	appids: number[],
	includeAppInfo: T = false as T,
	overrides?: Record<number, Partial<OwnedGame<T>>>,
): GetOwnedGamesResponse<T> {
	const games: OwnedGame<T>[] = appids.map((id) => {
		const base = makeOwnedGame(id, includeAppInfo);
		const extra = overrides?.[id] ?? {};
		return { ...base, ...extra };
	});
	return {
		response: {
			game_count: games.length,
			games,
		},
	};
}

// Common game fixtures
export const testGame1 = { appid: 1, name: "Test Game 1" };
export const testGame2 = { appid: 2, name: "Test Game 2" };

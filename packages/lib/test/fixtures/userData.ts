import type { SteamUserRaw } from "../../src/models";
import type { GetFriendsListResponse } from "../../src/repositories/api/steampowered/friends";
import type { GetPlayerSummariesResponse } from "../../src/repositories/api/steampowered/playerSummary";

/**
 * Create user data fixture for testing
 */
export function makeUserData(steamid: string): SteamUserRaw {
	return {
		steamid,
		personaname: `Test User ${steamid}`,
		profileurl: `https://steamcommunity.com/id/${steamid}/`,
		avatar: "https://example.com/avatar.jpg",
		avatarmedium: "https://example.com/avatar_medium.jpg",
		avatarfull: "https://example.com/avatar_full.jpg",
		avatarhash: "abcdef123456",
		personastate: 1,
		communityvisibilitystate: 3,
		profilestate: 1,
		lastlogoff: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
		commentpermission: 1,
		realname: `Real Name ${steamid}`,
		timecreated: Math.floor(Date.now() / 1000) - 31536000, // 1 year ago
		loccountrycode: "US",
		locstatecode: "CA",
		loccityid: 123456,
	} as SteamUserRaw;
}

/**
 * Build a properly typed GetPlayerSummariesResponse for a set of steamids.
 * Optionally override specific fields per user via a map keyed by steamid.
 */
export function makePlayerSummariesResponse(
	steamids: string[],
	overrides?: Record<string, Partial<GetPlayerSummariesResponse["response"]["players"][number]>>,
): GetPlayerSummariesResponse {
	const players: GetPlayerSummariesResponse["response"]["players"] = steamids.map((id) => {
		const base = makeUserData(id) as unknown as GetPlayerSummariesResponse["response"]["players"][number];
		const extra = overrides?.[id] ?? {};
		return { ...base, ...extra };
	});
	return { response: { players } };
}

// Common user fixtures
export const testUser1 = { steamid: "user-1", name: "Test User 1" };
export const testUser2 = { steamid: "user-2", name: "Test User 2" };

/**
 * Build a GetFriendsListResponse for a user with provided friend IDs.
 * friend_since defaults to now - index seconds unless provided.
 */
export function makeFriendsListResponse(
	userId: string,
	friendIds: string[],
	since?: number | Date,
): GetFriendsListResponse {
	const base =
		since instanceof Date
			? Math.floor(since.getTime() / 1000)
			: typeof since === "number"
				? since
				: Math.floor(Date.now() / 1000);

	return {
		friendslist: {
			friends: friendIds.map((fid, i) => ({
				steamid: fid,
				relationship: "friend",
				friend_since: base - i, // small variation for deterministic sorting
			})),
		},
	};
}

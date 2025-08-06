import type { SteamUserRaw } from "../../src/models";

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

// Common user fixtures
export const testUser1 = { steamid: "user-1", name: "Test User 1" };
export const testUser2 = { steamid: "user-2", name: "Test User 2" };

import type { APILanguageCode } from "../lang";

export type GetPlayerAchievementsQuery<L extends APILanguageCode | undefined> = {
    steamid: string; // 64-bit Steam ID
    appid: number; // AppID
    l?: L; // Language code
};

export type PlayerAchievement<L extends APILanguageCode | undefined> = {
    apiname: string; // Achievement name
    achieved: number; // 1 if the player has unlocked the achievement, 0 otherwise
    unlocktime: number; // Unix timestamp of when the achievement was unlocked
} & (L extends APILanguageCode
    ? {
          name?: string; // Localized achievement name
          description?: string; // Localized achievement description
      }
    : unknown);

export type GetPlayerAchievementsResponse<L extends APILanguageCode | undefined> = {
    playerstats: {
        steamID: string; // 64-bit Steam ID
        gameName: string; // Game name
        achievements: PlayerAchievement<L>[];
    };
};

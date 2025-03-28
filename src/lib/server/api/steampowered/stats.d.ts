export type GetUserStatsForGameQuery = {
    steamid: string; // 64-bit Steam ID
    appid: number; // AppID
};

export type GetUserStatsForGameResponse = {
    playerstats: {
        steamID: string;
        gameName: string;
        stats: Array<{
            name: string;
            value: number;
        }>;
        achievements: Array<{
            name: string;
            achieved: number;
        }>;
    };
};

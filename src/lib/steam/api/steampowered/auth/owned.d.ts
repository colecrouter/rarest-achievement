export type GetOwnedGamesQuery = {
    steamid: string; // 64-bit Steam ID
    include_appinfo?: boolean; // Include additional details (name, icon, logo) for each app
    include_played_free_games?: boolean; // Include free games the user has played
    appids_filter?: Array<number>; // Filter to only include these appids
};

export type OwnedGame = {
    appid: number; // AppID
    name: string; // Game name
    playtime_forever: number; // Total playtime in minutes
    img_icon_url: string; // URL to small icon
    img_logo_url: string; // URL to large logo
    has_community_visible_stats: boolean; // If game has community stats
    playtime_windows_forever?: number; // Playtime in minutes on Windows
    playtime_mac_forever?: number; // Playtime in minutes on Mac
    playtime_linux_forever?: number; // Playtime in minutes on Linux
};

export type GetOwnedGamesResponse = {
    game_count: number; // Number of owned games
    games: OwnedGame[];
};

export type GetOwnedGamesQuery<T extends boolean> = {
    steamid: string; // 64-bit Steam ID
    include_appinfo?: T; // Include additional details (name, icon, logo) for each app
    include_played_free_games?: boolean; // Include free games the user has played
    appids_filter?: Array<number>; // Filter to only include these appids
};

export type OwnedGame<T extends boolean> = {
    appid: number; // AppID
    playtime_2weeks?: number; // Playtime in the last 2 weeks in minutes
    playtime_forever?: number; // Total playtime in minutes
    rtime_last_played?: number; // Last time played in Unix timestamp seconds
} & (T extends true
    ? {
          name: string; // Game name
          img_icon_url: string; // URL to small icon
          img_logo_url: string; // URL to large logo
          has_community_visible_stats: boolean; // If game has community stats
      }
    : object);

export type GetOwnedGamesResponse<T extends boolean> = {
    response:
        | {
              game_count: number; // Number of owned games
              games: OwnedGame<T>[];
          }
        | {
              game_count: 0; // No games found
              games: undefined;
          };
};

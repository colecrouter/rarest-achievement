/**
 * YouTube API Playlists Request interface.
 */
export interface IPlaylistsRequest {
    /** Parts to retrieve (comma-separated) */
    part: string;
    /** Channel ID */
    channelId?: string;
    /** Playlist ID filter */
    id?: boolean;
    /** Retrieve only playlists from authenticated user's channels (OAuth only) */
    mine?: boolean;
    /** Maximum number of results (0-50, default: 5) */
    maxResults?: number;
    /** Pagination token */
    pageToken?: string;
    /** API access key */
    key: string;
}

/**
 * YouTube API Activities Request interface.
 */
export interface IActivitiesRequest {
    /** Parts to retrieve (comma-separated list) */
    part: string;
    /** Channel ID */
    channelId?: string;
    /** Retrieve authenticated user's home feed (OAuth only) */
    home?: boolean;
    /** Retrieve activities for user's channels (OAuth only) */
    mine?: boolean;
    /** Maximum number of results (0-50, default: 5) */
    maxResults?: number;
    /** Pagination token */
    pageToken?: string;
    /** Retrieve activities published after this datetime (ISO 8601) */
    publishedAfter?: string;
    /** Retrieve activities published before this datetime (ISO 8601) */
    publishedBefore?: string;
    /** Filter by region (ISO 3166-1 alpha-2) */
    regionCode?: string;
    /** API access key */
    key: string;
}

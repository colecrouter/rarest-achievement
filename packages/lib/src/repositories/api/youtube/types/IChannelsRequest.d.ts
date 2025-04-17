/**
 * YouTube API Channels Request interface.
 * Docs: https://developers.google.com/youtube/v3/docs/channels/list
 */
export interface IChannelsRequest {
    /** Parts to retrieve (comma-separated list) */
    part: string;
    /** Channel ID */
    id?: string;
    /** YouTube guide category ID */
    categoryId?: string;
    /** YouTube username */
    forUsername?: string;
    /** Return channels owned by the authenticated user (OAuth only) */
    mine?: boolean;
    /** Content owner identifier (OAuth, for content partners) */
    onBehalfOfContentOwner?: string;
    /** Maximum number of results (0-50, default: 5) */
    maxResults?: number;
    /** Pagination token */
    pageToken?: string;
    /** API access key */
    key: string;
}

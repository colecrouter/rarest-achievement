/**
 * YouTube API Videos Request interface.
 * Docs: https://developers.google.com/youtube/v3/docs/videos/list
 *
 * Specify one of:
 * - Video ID via `id`
 * - Most popular videos via `chart`
 * - Authenticated user's rated videos via `myRating`
 */
export interface IVideosRequest {
    /** Parts to retrieve (comma-separated) */
    part: string;
    /** Target video ID */
    id?: string;
    /** Chart type, only 'mostPopular' is allowed (use with regionCode or videoCategoryId) */
    chart?: "mostPopular";
    /** Region code (ISO 3166-1 alpha-2), used with 'chart' */
    regionCode?: string;
    /** Video category ID, used with 'chart' */
    videoCategoryId?: string;
    /** Filter by authenticated user's rated videos (if OAuth) */
    myRating?: "like" | "dislike";
    /** Maximum results (0-50, default: 5) */
    maxResults?: number;
    /** Pagination token */
    pageToken?: string;
    /** On behalf of content owner (OAuth only, for partners) */
    onBehalfOfContentOwner?: string;
    /** API access key */
    key: string;
}

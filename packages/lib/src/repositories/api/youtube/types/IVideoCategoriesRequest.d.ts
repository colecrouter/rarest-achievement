/**
 * YouTube API Video Categories Request interface.
 * Docs: https://developers.google.com/youtube/v3/docs/videoCategories/list
 */
export interface IVideoCategoriesRequest {
    /** Parts to retrieve (comma-separated) */
    part: string;
    /** Video category ID */
    id?: string;
    /** Filter by region (ISO 3166-1 alpha-2, e.g. JP, US) */
    regionCode?: string;
    /** Language for text values (default: en-US) */
    hl?: string;
    /** API access key */
    key: string;
}

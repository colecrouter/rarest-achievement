/**
 * YouTube API Guide Categories Request interface.
 */
export interface IGuideCategoriesRequest {
    /** Parts to retrieve (comma-separated) */
    part: string;
    /** Filter by category ID(s) */
    id?: string;
    /** Filter by region (ISO 3166-1 alpha-2, e.g. JP, US) */
    regionCode?: string;
    /** Language for text values (default: en-US) */
    hl?: string;
    /** API access key */
    key: string;
}

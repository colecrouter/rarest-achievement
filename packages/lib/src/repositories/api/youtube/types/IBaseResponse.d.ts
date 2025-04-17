/**
 * Common YouTube API response interface.
 */
export interface IBaseResponse {
    /** Resource type (e.g. youtube#channelListResponse) */
    kind: string;
    /** Resource ETag */
    etag: string;
}

/**
 * Response interface with pagination information.
 */
export interface IBasePageInfoResponse {
    /** Paging information */
    pageInfo: {
        /** Total results */
        totalResults: number;
        /** Number of results in this response */
        resultsPerPage: number;
    };
    /** Token for the next page */
    nextPageToken: string;
    /** Token for the previous page */
    prevPageToken: string;
}

/**
 * Thumbnail information in various sizes.
 */
export interface IBaseThumbnail {
    /** Default thumbnail */
    default: IBaseThumbnailItem;
    /** Medium thumbnail */
    medium: IBaseThumbnailItem;
    /** High resolution thumbnail */
    high: IBaseThumbnailItem;
}
export interface IBaseThumbnailItem {
    /** Image URL */
    url: string;
    /** Image width */
    width: number;
    /** Image height */
    height: number;
}

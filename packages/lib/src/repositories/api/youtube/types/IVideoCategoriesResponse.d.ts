import type { IBaseResponse } from "./IBaseResponse";

/**
 * YouTube API Video Categories Response interface.
 * Docs: https://developers.google.com/youtube/v3/docs/videoCategories/list
 */
export interface IVideoCategoriesResponse extends IBaseResponse {
    /** Array of video category items */
    items: {
        kind: string;
        etag: string;
        /** Video category ID */
        id: string;
        /** Basic info */
        snippet: {
            /** Category title */
            title: string;
            /** Indicates if this category is assignable to a video */
            assignable: boolean;
            /** Channel ID that created the category */
            channelId: string;
        };
    }[];
}

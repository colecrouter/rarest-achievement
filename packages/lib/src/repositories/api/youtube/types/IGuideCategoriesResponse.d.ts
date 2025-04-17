import type { IBaseResponse } from "./IBaseResponse";

/**
 * YouTube API Guide Categories Response interface.
 */
export interface IGuideCategoriesResponse extends IBaseResponse {
    /** Array of guide category items */
    items: {
        kind: "youtube#guideCategory";
        etag: string;
        /** Guide category ID */
        id: string;
        /** Basic category info */
        snippet: {
            /** Channel ID that published the category */
            channelId: string;
            /** Category title */
            title: string;
        };
    }[];
}

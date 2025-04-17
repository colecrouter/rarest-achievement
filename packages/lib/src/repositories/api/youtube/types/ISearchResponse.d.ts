import type { IBasePageInfoResponse, IBaseResponse, IBaseThumbnail } from "./IBaseResponse";

/**
 * YouTube API Search Response interface.
 * Docs: https://developers.google.com/youtube/v3/docs/search/list
 */
export interface ISearchResponse extends IBaseResponse, IBasePageInfoResponse {
    /** Array of search results */
    items: {
        kind: string;
        etag: string;
        id:
            | { kind: "youtube#video"; videoId: string }
            | { kind: "youtube#channel"; channelId: string }
            | { kind: "youtube#playlist"; playlistId: string };
        /** Result details */
        snippet: ISearchResponse_Snippet;
    }[];
}

export interface ISearchResponse_Snippet {
    /** Publication date (ISO 8601) */
    publishedAt: string;
    /** Publisher channel ID */
    channelId: string;
    /** Publisher channel title */
    channelTitle: string;
    /** Content title */
    title: string;
    /** Content description */
    description: string;
    /** Thumbnails */
    thumbnails: IBaseThumbnail;
    /** Live broadcast status: live, upcoming, or none */
    liveBroadcastContent: "live" | "upcoming" | "none";
    /** Publish time (ISO 8601) */
    publishTime: string;
}

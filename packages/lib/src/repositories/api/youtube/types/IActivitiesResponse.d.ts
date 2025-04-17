import type { IBasePageInfoResponse, IBaseResponse, IBaseThumbnail } from "./IBaseResponse";

/**
 * YouTube API Activities Response.
 */
export interface IActivitiesResponse extends IBaseResponse, IBasePageInfoResponse {
    /** Array of activity items */
    items: {
        kind: string;
        etag: string;
        id: string;
        /** Activity details */
        snippet: IActivitiesResponse_Snippet;
        /** Content details related to the activity */
        contentDetails: IActivitiesResponse_ContentDetail;
    }[];
}

/**
 * Activity details.
 */
export interface IActivitiesResponse_Snippet {
    /** Publication date (ISO 8601) */
    publishedAt: string;
    /** Activity type */
    type: string;
    /** Channel ID for the activity */
    channelId: string;
    /** Channel title */
    channelTitle: string;
    /** Resource title */
    title: string;
    /** Resource description */
    description: string;
    /** Thumbnails */
    thumbnails: IBaseThumbnail;
    /** Group identifier for activities */
    groupId: string;
}

/**
 * Activity content details.
 */
export interface IActivitiesResponse_ContentDetail {
    /** Uploaded video details (if type is 'upload') */
    upload: { videoId: string };
    /** Liked video details (if type is 'like') */
    like: { resourceId: { kind: string; videoId: string } };
    /** Favorited video details (if type is 'favorite') */
    favorite: { resourceId: { kind: string; videoId: string } };
    /** Commented resource details (if type is 'comment') */
    comment: { resourceId: { kind: string; videoId: string; channelId: string } };
    /** Subscribed channel details (if type is 'subscription') */
    subscription: { resourceId: { kind: string; channelId: string } };
    /** Playlist item addition details (if type is 'playlistItem') */
    playlistItem: {
        resourceId: { kind: string; videoId: string };
        playlistId: string;
        playlistItemId: string;
    };
    /** Recommended content details (if type is 'recommendation') */
    recommendation: {
        resourceId: { kind: string; videoId: string; channelId: string };
        reason: "unspecified" | "videoFavorited" | "videoLiked" | "videoWatched";
        seedResourceId: {
            kind: string;
            videoId: string;
            channelId: string;
            playlistId: string;
        };
    };
    /** Bulletin message details (if type is 'bulletin') */
    bulletin: {
        resourceId: { kind: string; videoId: string; channelId: string; playlistId: string };
        playlistId: string;
        playlistItemId: string;
    };
    /** Social post details (if type is 'social') */
    social: {
        /** Type of social network */
        type: "facebook" | "googlePlus" | "twitter" | "unspecified";
        resourceId: { kind: string; videoId: string; channelId: string; playlistId: string };
        /** Author of the post */
        author: string;
        /** Image URL of the post */
        imageUrl: string;
        /** Reference URL */
        referenceUrl: string;
    };
    /** Channel item addition details (if type is 'channelItem') */
    channelItem: {
        /** Due to lack of docs, using any type */
        resourceId: unknown;
    };
}

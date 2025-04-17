import type { IBasePageInfoResponse, IBaseResponse, IBaseThumbnail } from "./IBaseResponse";

/**
 * YouTube API Videos Response interface.
 * Docs: https://developers.google.com/youtube/v3/docs/videos/list
 */
export interface IVideosResponse extends IBaseResponse, IBasePageInfoResponse {
    /** Array of video items */
    items: {
        kind: string;
        etag: string;
        id: string;
        /** Video basic info */
        snippet: IVideosResponse_Snippet;
        /** Video content details */
        contentDetails: IVideosResponse_ContentDetail;
        /** Video status info */
        status: IVideosResponse_Status;
        /** Video statistics */
        statistics: IVideosResponse_Statistic;
        /** Embed player HTML snippet */
        player: IVideosResponse_Player;
        /** Freebase topic details */
        topicDetails: IVideosResponse_TopicDetail;
        /** Video recording details */
        recordingDetails: IVideosResponse_RecordingDetails;
        /** Live streaming details */
        liveStreamingDetails: IVideosResponse_LiveStreamingDetails;
    }[];
}

export interface IVideosResponse_Snippet {
    /** Video publication date (ISO 8601) */
    publishedAt: string;
    /** Channel ID that posted the video */
    channelId: string;
    /** Channel title */
    channelTitle: string;
    /** Video title */
    title: string;
    /** Video description */
    description: string;
    /** Thumbnails */
    thumbnails: IBaseThumbnail;
    /** Video tags */
    tags: string[];
    /** Video category ID */
    categoryId: string;
    /** Live broadcast status: live, upcoming, or none */
    liveBroadcastContent: "live" | "upcoming" | "none";
    /** Default language (e.g. 'ja') */
    defaultLanguage: string;
    /** Default audio language (e.g. 'ja') */
    defaultAudioLanguage: string;
}

export interface IVideosResponse_ContentDetail {
    /** Video duration (ISO8601, e.g. PT15M51S) */
    duration: string;
    /** Video dimension, e.g. '2d' or '3d' */
    dimension: string;
    /** Video definition: high (HD) or standard (SD) */
    definition: "hd" | "sd";
    /** Whether the video has captions */
    caption: "true" | "false";
    /** Indicates if the video is licensed content */
    licensedContent: boolean;
    /** Region restriction details (if any) */
    regionRestriction: {
        /** Allowed country codes */
        allowed: string[];
        /** Blocked country codes */
        blocked: string[];
    };
    /** Simplified content rating details */
    contentRating: {
        eirinRating: "eirinG" | "eirinPg12" | "eirinR15plus" | "eirinR18plus" | "eirinUnrated";
        ytRating: "ytAgeRestricted";
    };
    /** Projection information (e.g. 'rectangular') */
    projection: string;
}

export interface IVideosResponse_Status {
    /** Upload status: deleted, failed, processed, rejected, or uploaded */
    uploadStatus: "deleted" | "failed" | "processed" | "rejected" | "uploaded";
    /** Failure reason (if uploadStatus is 'failed') */
    failureReason: "codec" | "conversion" | "emptyFile" | "invalidFile" | "tooSmall" | "uploadAborted";
    /** Rejection reason (if uploadStatus is 'rejected') */
    rejectionReason:
        | "claim"
        | "copyright"
        | "duplicate"
        | "inappropriate"
        | "length"
        | "termsOfUse"
        | "trademark"
        | "uploaderAccountClosed"
        | "uploaderAccountSuspended";
    /** Video privacy status */
    privacyStatus: "private" | "public" | "unlisted";
    /** Video license type */
    license: "creativeCommon" | "youtube";
    /** Whether the video is embeddable */
    embeddable: boolean;
    /** If public stats are viewable */
    publicStatsViewable: boolean;
    /** Whether video is marked as made for kids */
    madeForKids: boolean;
}

export interface IVideosResponse_Statistic {
    /** View count */
    viewCount: string;
    /** Like count */
    likeCount: string;
    /** Dislike count */
    dislikeCount: string;
    /** Favorite count (at time of API request) */
    favoriteCount: string;
    /** Comment count */
    commentCount: string;
}

export interface IVideosResponse_Player {
    /** Embed HTML snippet for the video player */
    embedHtml: string;
}

export interface IVideosResponse_TopicDetail {
    /** Primary topic category Freebase IDs */
    topicCategories: string[];
    /** Relevant topic IDs */
    relevantTopicIds: string[];
}

export interface IVideosResponse_RecordingDetails {
    /** Recording location details */
    location: {
        latitude: number;
        longitude: number;
        altitude: number;
    };
    /** Recording date (ISO 8601) */
    recordingDate: string;
}

export interface IVideosResponse_LiveStreamingDetails {
    /** Actual start time (ISO 8601) */
    actualStartTime: string;
    /** Actual end time (ISO 8601) */
    actualEndTime: string;
    /** Scheduled start time (ISO 8601) */
    scheduledStartTime: string;
}

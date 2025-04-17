/**
 * YouTube API Search Request interface.
 * Docs: https://developers.google.com/youtube/v3/docs/search/list
 */
export interface ISearchRequest {
    /** Parts to retrieve (comma-separated list) */
    part: string;
    /** Search query */
    q?: string;
    /** Filter by related video ID (requires type 'video') */
    relatedToVideoId?: string;
    /** Filter to authenticated user's videos (OAuth only, requires type 'video') */
    forMine?: boolean;
    /** Filter by content owner (OAuth only) */
    forContentOwner?: boolean;
    /** Filter by content owner's data (OAuth only) */
    onBehalfOfContentOwner?: string;
    /** Filter by channel ID */
    channelId?: string;
    /** Filter by channel type: any or show */
    channelType?: "any" | "show";
    /** Filter by event type: completed, live, or upcoming */
    eventType?: "completed" | "live" | "upcoming";
    /** Maximum results (0-50, default: 5) */
    maxResults?: number;
    /** Pagination token */
    pageToken?: string;
    /** Order: date, rating, relevance, title, videoCount, or viewCount */
    order?: "date" | "rating" | "relevance" | "title" | "videoCount" | "viewCount";
    /** Retrieve videos published after this datetime (ISO 8601) */
    publishedAfter?: string;
    /** Retrieve videos published before this datetime (ISO 8601) */
    publishedBefore?: string;
    /** Filter by region (ISO 3166-1 alpha-2) */
    regionCode?: string;
    /** Safe search filter: moderate, none, or strict */
    safeSearch?: "moderate" | "none" | "strict";
    /** Filter by video category ID */
    videoCategoryId?: string;
    /** Filter by topic ID */
    topicId?: string;
    /** Search result type: video, channel, or playlist */
    type?: "video" | "channel" | "playlist";
    /** Filter by video definition: high, standard, or any */
    videoDefinition?: "high" | "standard" | "any";
    /** Filter by caption: closedCaption, none, or any */
    videoCaption?: "closedCaption" | "none" | "any";
    /** Filter by video dimension: 2d, 3d, or any */
    videoDimension?: "2d" | "3d" | "any";
    /** Filter by video duration: short, medium, long, or any */
    videoDuration?: "short" | "medium" | "long" | "any";
    /** Filter embeddable videos: true or any */
    videoEmbeddable?: "true" | "any";
    /** Filter by video license: creativeCommon, youtube, or any */
    videoLicense?: "creativeCommon" | "youtube" | "any";
    /** Filter by syndicated availability: true or any */
    videoSyndicated?: "true" | "any";
    /** Filter by video type: episode, movie, or any */
    videoType?: "episode" | "movie" | "any";
    /** API access key */
    key: string;
}

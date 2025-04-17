import type { IBasePageInfoResponse, IBaseResponse, IBaseThumbnail } from "./IBaseResponse";

/**
 * YouTube API channels response.
 */
export interface IChannelsResponse extends IBaseResponse, IBasePageInfoResponse {
    /** Array of channel items. */
    items: {
        kind: string;
        etag: string;
        id: string;
        /** Basic channel information. */
        snippet: IChannelsResponse_Snippet;
        /** Content details. */
        contentDetails: IChannelsResponse_ContentDetail;
        /** Channel statistics. */
        statistics: IChannelsResponse_Statistic;
        /** Privacy status. */
        status: IChannelsResponse_Status;
        /** Topic details. */
        topicDetails: IChannelsResponse_TopicDetail;
        /** Branding settings. */
        brandingSettings: IChannelsResponse_BrandingSetting;
    }[];
}

// Channel snippet information.
export interface IChannelsResponse_Snippet {
    /** Channel title. */
    title: string;
    /** Channel description. */
    description: string;
    /** Custom URL. */
    customUrl: string;
    /** Creation date in ISO 8601. */
    publishedAt: string;
    /** Thumbnails. */
    thumbnails: IBaseThumbnail;
    /** Country. */
    country: string;
}

// Channel content details.
export interface IChannelsResponse_ContentDetail {
    /** Automatically generated playlists. */
    relatedPlaylists: {
        /** Playlist ID for liked videos (empty if private). */
        likes: string;
        /** Playlist ID for uploads. */
        uploads: string;
    };
}

// Channel statistics.
export interface IChannelsResponse_Statistic {
    /** Total view count. */
    viewCount: string;
    /** Subscriber count. */
    subscriberCount: string;
    /** Whether the subscriber count is public. */
    hiddenSubscriberCount: boolean;
    /** Total video count (including live streams). */
    videoCount: string;
}

// Channel topic details.
export interface IChannelsResponse_TopicDetail {
    /** Topic IDs. */
    topicIds: string[];
    /** Topic categories. */
    topicCategories: string[];
}

// Channel status.
export interface IChannelsResponse_Status {
    /** Privacy status: "private", "public", or "unlisted". */
    privacyStatus: string;
    /** Indicates if the channel is linked to a Google account. */
    isLinked: boolean;
    /** Uploads status. */
    longUploadsStatus: string;
    /** Whether the channel is made for kids. */
    madeForKids: boolean;
}

// Channel branding settings.
export interface IChannelsResponse_BrandingSetting {
    channel: {
        /** Channel title. */
        title: string;
        /** Channel description. */
        description: string;
        /** Keywords. */
        keywords: string;
        /** Default tab. */
        defaultTab: string;
        /** Google Analytics account ID. */
        trackingAnalyticsAccountId: string;
        /** Trailer video ID for unsubscribed viewers. */
        unsubscribedTrailer: string;
        /** Country. */
        country: string;
    };
    image: {
        /** Banner image URL. */
        bannerExternalUrl: string;
    };
}

import type { IBasePageInfoResponse, IBaseResponse, IBaseThumbnail } from "./IBaseResponse";

/**
 * YouTube API Playlists Response interface
 */
export interface IPlaylistsResponse extends IBaseResponse, IBasePageInfoResponse {
    /** Array of playlist items */
    items: {
        kind: string;
        etag: string;
        id: string;
        /** Basic playlist info */
        snippet: IPlaylistsResponse_Snippet;
        /** Playlist status (privacy) */
        status: IPlaylistsResponse_Status;
        /** Content details (video count) */
        contentDetails: IPlaylistsResponse_ContentDetails;
        /** Embed player HTML snippet */
        player: IPlaylistsResponse_Player;
    }[];
}

export interface IPlaylistsResponse_Snippet {
    /** Publication date (ISO 8601) */
    publishedAt: string;
    /** Playlist type identifier */
    type: string;
    /** Creator channel ID */
    channelId: string;
    /** Creator channel title */
    channelTitle: string;
    /** Playlist title */
    title: string;
    /** Playlist description */
    description: string;
    /** Thumbnails */
    thumbnails: IBaseThumbnail;
    /** Playlist tags */
    tags: string[];
}

export interface IPlaylistsResponse_Status {
    /** Privacy status: private, public, or unlisted */
    privacyStatus: string;
}

export interface IPlaylistsResponse_ContentDetails {
    /** Number of videos in the playlist */
    itemCount: number;
}

export interface IPlaylistsResponse_Player {
    /** HTML snippet for the playlist player */
    embedHtml: string;
}

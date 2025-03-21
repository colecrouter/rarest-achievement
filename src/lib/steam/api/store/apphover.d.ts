// https://github.com/Revadike/InternalSteamWebAPI/wiki/Get-App-Hover

export type GetAppHoverQuery = {
    appid: string;
    cc?: string; // ISO 3166-1 alpha-2 country code
    l?: string; // Language code
};

/**
 * Path: /apphover/:appid
 */
export type GetAppHoverResponse = {
    strReleaseDate: string;
    strDescription: string;
    rgScreenshots: {
        appid: number;
        id: number;
        filename: string;
        all_ages: string;
    }[];
    rgCategories: {
        strDisplayName: string;
    }[];
    strGenres: string;
    strMicroTrailerURL: string;
    ReviewSummary: {
        strReviewSummary: string;
        cReviews: number;
        cRecommendationsPositive: number;
        cRecommendationsNegative: number;
        nReviewScore: number;
    };
    rgFriendsThatWantGame: unknown[];
    rgFriendsThatOwnGame: {
        ulSteamid: string;
        strState: string;
        nPlaytimeTwoWeeks: number;
        nPlaytimeForever: number;
    }[];
    cTotalFriendRecommendations: number;
} | null;

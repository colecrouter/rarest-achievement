// Added types for appreviews

export type GetAppReviewsQuery = {
    cursor?: string;
    json?: "1" | "0";
    day_range?: string;
    start_date?: string;
    end_date?: string;
    date_range_type?: "include" | "exclude" | "all";
    filter?: "recent" | "updated" | "all" | "summary";
    language?: string;
    l?: string;
    review_type?: "all" | "positive" | "negative";
    purchase_type?: "all" | "non_steam_purchase" | "steam";
    playtime_filter_min?: string;
    playtime_filter_max?: string;
    filter_offtopic_activity?: string;
    summary_num_positive_reviews?: string;
    summary_num_reviews?: string;
    num_per_page?: string;
};

export interface QuerySummary {
    num_reviews: number;
    review_score: number;
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
}

export interface AppReviewAuthor {
    steamid: string;
    num_games_owned: number;
    num_reviews: number;
    playtime_forever: number;
    playtime_last_two_weeks: number;
    playtime_at_review: number;
    last_played: number;
}

export interface AppReview {
    recommendationid: string;
    author: AppReviewAuthor;
    language: string;
    review: string;
    timestamp_created: number;
    timestamp_updated: number;
    voted_up: boolean;
    votes_up: number;
    votes_funny: number;
    weighted_vote_score: string;
    comment_count: number;
    steam_purchase: boolean;
    received_for_free: boolean;
    written_during_early_access: boolean;
}

export interface GetAppReviewsResponse {
    success: 1;
    query_summary: QuerySummary;
    reviews: AppReview[];
    cursor: string;
}

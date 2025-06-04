import { benchmarkEstimate } from "./playerEstimate.js";

const inputFeatures = {
    total_reviews: 100,
    review_score: 5,
    is_free: 1,
    price: 0,
    all_time_peak: 21,
    avg_count: 2.5,
    day_peak: 2,
    release_date_numeric: new Date("October 30, 2017").getTime() / 1000,
};

benchmarkEstimate(inputFeatures);

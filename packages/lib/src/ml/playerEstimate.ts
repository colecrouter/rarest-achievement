import XGBoostModel from "../../steam_model.json" with { type: "json" };
import type { SearchResults, Tree } from "./model";
import { predict } from "./predict";
const modelObj = XGBoostModel as SearchResults;

type Features = {
    /** Total number of reviews, as reported by `store.steampowered.com/appreviews/{app_id}` */
    total_reviews: number;
    /** Review score, as reported by `store.steampowered.com/appreviews/{app_id}`. This appears to be a score between 1-10 (0-9?) */
    review_score: number;
    /** Whether the app is free (0) or not (1) */
    is_free: number;
    /** Price of the app in cents (e.g. 499 for $4.99) in USD(?) */
    price: number;
    /** All time peak player count, as reported by `steamcharts.com/app/{app_id}/chart-data.json` */
    all_time_peak: number;
    /** Average player count, as reported by `steamcharts.com/app/{app_id}/chart-data.json` */
    avg_count: number;
    /** Peak player count for the last 24 hours, as reported by `steamcharts.com/app/{app_id}/chart-data.json` */
    day_peak: number;
    /** Release date of the app, as a Unix timestamp (seconds since 1970-01-01). E.g. `Date.now() / 1000` */
    release_date_numeric: number;
};

/* ===== Example Usage ===== */

// // Let’s assume you have inputs corresponding to the model’s expected features:
// const inputFeatures = {
//     total_reviews: 100,
//     review_score: 5,
//     is_free: 1,
//     price: 0,
//     all_time_peak: 21,
//     avg_count: 2.5,
//     day_peak: 2,
//     release_date_numeric: new Date("October 30, 2017").getTime() / 1000,
// };

// // Now compute the prediction:
// console.time("Prediction Time");
// const result = predict(modelObj, inputFeatures);
// console.timeEnd("Prediction Time");
// console.log("Prediction:", result);

// // cd packages/lib/src/scikit-learn
// // node --experimental-strip-types score.ts

export const estimatePlayerCount = (features: Features): number => predict(modelObj, features);

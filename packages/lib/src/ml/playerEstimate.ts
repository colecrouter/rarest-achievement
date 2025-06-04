import XGBoostModel from "../../steam_model.json" with { type: "json" };
import type { SearchResults } from "./model.js";
import { predict } from "./predict.js";
import * as wasm from "../assembly/index.js";

const modelObj = XGBoostModel as SearchResults;

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

// === new benchmark ===
/** Compare JS vs WASM predict performance */
export async function benchmarkEstimate(features: Features): Promise<void> {
    console.time("JS predict");
    const jsRes = predict(modelObj, features);
    console.timeEnd("JS predict");

    console.time("WASM predict");
    const wasmRes = wasm.predict(modelObj, features);
    console.timeEnd("WASM predict");

    console.log("results:", { js: jsRes, wasm: wasmRes });
}

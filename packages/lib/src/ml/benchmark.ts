import { predict as wasmPredict } from "./wasm/predict.js";
import { predict as jsPredict } from "./predict.ts";
import type { Features, SearchResults } from "./model.js";
import XGBoostModel from "../../steam_model.json" with { type: "json" };

const inputFeatures = {
    total_reviews: 100,
    review_score: 5,
    is_free: 1,
    price: 0,
    all_time_peak: 21,
    avg_count: 2.5,
    day_peak: 2,
    release_date_numeric: new Date("October 30, 2017").getTime() / 1000,
} satisfies Features;

// node --experimental-strip-types score.ts

export async function benchmarkEstimate(model: SearchResults, features: Features): Promise<void> {
    console.time("JS predict");
    const jsRes = jsPredict(model, features);
    console.timeEnd("JS predict");

    console.time("WASM predict");
    const wasmRes = wasmPredict(model, features);
    console.timeEnd("WASM predict");

    console.assert(jsRes === wasmRes, "JS and WASM predictions should match");
}

benchmarkEstimate(XGBoostModel as SearchResults, inputFeatures);

import XGBoostModel from "../../steam_model.json" with { type: "json" };
import type { Features, SearchResults } from "./model.ts";
import { predict } from "./predict.js";

const modelObj = XGBoostModel as SearchResults;

export const estimatePlayerCount = (features: Features): number => predict(modelObj, features);

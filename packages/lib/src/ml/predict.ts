import XGBoostModel from "../../steam_model.json" with { type: "json" };
import type { SearchResults, Tree } from "./model";
const modelObj = XGBoostModel as SearchResults;

/**
 * Traverses a single tree to compute its prediction contribution.
 *
 * @param {Tree} tree - A tree from modelObj.learner.gradient_booster.model.trees.
 * @param {Record<string, number>} features - An object mapping feature names to numeric values.
 * @param {Array<string>} featureNames - The feature names (used with split_indices).
 * @returns {number} - The prediction from the tree.
 */
function predictTree(tree: Tree, features: Record<string, number>, featureNames: Array<string>): number {
    // start at the tree root (node 0)
    let node = 0;
    while (true) {
        // In these JSON dumps the children arrays contain -1 for leaf nodes.
        // If both left and right children are -1 we are at a leaf node.
        if (tree.left_children[node] === -1 && tree.right_children[node] === -1) {
            const weight = tree.base_weights[node];
            if (weight === undefined) throw new Error("Base weight is undefined");
            return weight;
        }

        // Updated check for a valid feature index and threshold.
        const featureIndex = tree.split_indices[node];
        if (featureIndex === undefined) throw new Error("Feature index is undefined");
        const threshold = tree.split_conditions[node];
        if (threshold === undefined) throw new Error("Threshold is undefined");
        const featureName = featureNames[featureIndex];
        if (!featureName) throw new Error("Feature name is undefined");

        // Look up the value from our input.
        const value = features[featureName];
        let intermediateNode: number | undefined = undefined;
        if (value === undefined) {
            // If the feature is missing, one could inspect tree.default_left[node].
            // For our example we choose to always go to the left child.
            intermediateNode = tree.default_left[node];
        } else {
            // Compare the feature value with the threshold.
            // Many XGBoost models assume: if feature_value < threshold, take left;
            // otherwise (>= threshold) take right.
            if (value < threshold) {
                intermediateNode = tree.left_children[node];
            } else {
                intermediateNode = tree.right_children[node];
            }
        }

        if (intermediateNode === undefined) throw new Error("Intermediate node is undefined");
        // Move to the next node.
        node = intermediateNode;
    }
}

/**
 * Computes the full model prediction.
 *
 * @param {SearchResults} model - The JSON-parsed model object.
 * @param {Record<string, number>} features - An object mapping feature names to numeric values.
 * @returns {number} - The overall prediction.
 */
export function predict(model: SearchResults, features: Record<string, number>): number {
    // Get the base score from the model parameters.
    // This value is provided as a string, so convert it to a number.
    const baseScore = Number.parseFloat(model.learner.learner_model_param.base_score);

    // Extract the list of feature names (in the order expected by the trees)
    const featureNames = model.learner.feature_names;

    // Extract the “gradient booster” model containing the trees.
    const booster = model.learner.gradient_booster.model;
    const trees = booster.trees;

    // In many gbtrees the final prediction is the base score plus the sum of all tree predictions.
    let prediction = baseScore;

    // Sum the predictions from each tree.
    for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        if (!tree) throw new Error("Tree is undefined");
        const treePrediction = predictTree(tree, features, featureNames);
        prediction += treePrediction;
    }
    return prediction;
}

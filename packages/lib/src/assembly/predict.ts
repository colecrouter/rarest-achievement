// biome-ignore lint/style/useImportType: <explanation>
import { SearchResults, Tree, Features } from "../ml/model";

/**
 * Traverses a single tree to compute its prediction contribution.
 *
 * @param tree        A single Tree instance.
 * @param features    A Map from feature name → value.
 * @param featureNames The list of feature names (by index).
 * @returns f64       The tree’s predicted contribution.
 */
export function predictTree(tree: Tree, features: Features, featureNames: Array<string>): f64 {
    let node: i32 = 0;
    while (true) {
        // leaf check: both children = -1
        if (tree.left_children[node] === -1 && tree.right_children[node] === -1) {
            // must exist
            return tree.base_weights[node];
        }
        // internal node
        let featureIndex = tree.split_indices[node];
        let threshold = tree.split_conditions[node];
        let fname = featureNames[featureIndex];
        if (!fname) {
            throw new Error("Feature name is undefined");
        }
        // lookup
        let maybeVal = features[fname];
        let nextNode: i32;
        if (maybeVal === null) {
            // missing → go default
            nextNode = tree.default_left[node] as i32;
        } else {
            let value = maybeVal as f64;
            if (value < threshold) {
                nextNode = tree.left_children[node] as i32;
            } else {
                nextNode = tree.right_children[node] as i32;
            }
        }
        node = nextNode;
    }
}

/**
 * Computes the full model prediction.
 *
 * @param model     The parsed SearchResults.
 * @param features  A Map from feature name → value.
 * @returns f64     The overall prediction.
 */
export function predict(model: SearchResults, features: Features): f64 {
    // parse base score
    let baseScore = f32.parse(model.learner.learner_model_param.base_score);
    let featureNames = model.learner.feature_names;
    let trees = model.learner.gradient_booster.model.trees;
    let prediction: f64 = baseScore;
    for (let i = 0, n = trees.length; i < n; ++i) {
        let tree = trees[i];
        if (!tree) throw new Error("Tree is undefined");
        prediction += predictTree(tree, features, featureNames);
    }
    return prediction;
}

use serde::Deserialize;
use serde_wasm_bindgen::from_value;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
struct Tree {
    left_children: Vec<i32>,
    right_children: Vec<i32>,
    base_weights: Vec<f64>,
    split_indices: Vec<usize>,
    split_conditions: Vec<f64>,
    default_left: Vec<i32>,
}

#[derive(Deserialize)]
struct GradientBoosterModel {
    trees: Vec<Tree>,
}

#[derive(Deserialize)]
struct GradientBooster {
    model: GradientBoosterModel,
}

#[derive(Deserialize)]
struct LearnerModelParam {
    base_score: String,
}

#[derive(Deserialize)]
struct Learner {
    learner_model_param: LearnerModelParam,
    feature_names: Vec<String>,
    gradient_booster: GradientBooster,
}

#[derive(Deserialize)]
struct SearchResults {
    learner: Learner,
}

fn predict_tree(tree: &Tree, features: &HashMap<String, f64>, feature_names: &[String]) -> f64 {
    let mut node = 0;
    loop {
        if tree.left_children[node] == -1 && tree.right_children[node] == -1 {
            return tree.base_weights[node];
        }
        let feature_index = tree.split_indices[node];
        let threshold = tree.split_conditions[node];
        let feature_name = &feature_names[feature_index];
        let value_opt = features.get(feature_name);
        let next_node = match value_opt {
            None => tree.default_left[node],
            Some(v) if *v < threshold => tree.left_children[node],
            _ => tree.right_children[node],
        };
        node = next_node as usize;
    }
}

fn predict_main(model: &SearchResults, features: &HashMap<String, f64>) -> f64 {
    let base_score: f64 = model
        .learner
        .learner_model_param
        .base_score
        .parse()
        .unwrap();
    let feature_names = &model.learner.feature_names;
    let trees = &model.learner.gradient_booster.model.trees;
    let mut prediction = base_score;
    for tree in trees {
        prediction += predict_tree(tree, features, feature_names);
    }
    prediction
}

#[wasm_bindgen]
pub fn predict(model: JsValue, features: JsValue) -> Result<f64, JsValue> {
    let model: SearchResults = from_value(model)?;
    let features: HashMap<String, f64> = from_value(features)?;
    Ok(predict_main(&model, &features))
}

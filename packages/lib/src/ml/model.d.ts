/*
    This file represents the structure of a JSON-exported scikit-learn model.
*/

export interface SearchResults {
    learner: Learner;
    version: number[];
}

export interface Learner {
    attributes: Attributes;
    feature_names: string[];
    feature_types: string[];
    gradient_booster: GradientBooster;
    learner_model_param: LearnerModelParam;
    objective: Objective;
}

export interface Attributes {
    scikit_learn: string;
}

export interface GradientBooster {
    model: Model;
    name: string;
}

export interface Model {
    gbtree_model_param: GbtreeModelParam;
    iteration_indptr: number[];
    tree_info: number[];
    trees: Tree[];
}

export interface GbtreeModelParam {
    num_parallel_tree: string;
    num_trees: string;
}

export interface Tree {
    base_weights: number[];
    categories: unknown[];
    categories_nodes: unknown[];
    categories_segments: unknown[];
    categories_sizes: unknown[];
    default_left: number[];
    id: number;
    left_children: number[];
    loss_changes: number[];
    parents: number[];
    right_children: number[];
    split_conditions: number[];
    split_indices: number[];
    split_type: number[];
    sum_hessian: number[];
    tree_param: TreeParam;
}

export interface TreeParam {
    num_deleted: string;
    num_feature: string;
    num_nodes: string;
    size_leaf_vector: string;
}

export interface LearnerModelParam {
    base_score: string;
    boost_from_average: string;
    num_class: string;
    num_feature: string;
    num_target: string;
}

export interface Objective {
    name: string;
    reg_loss_param: RegLossParam;
}

export interface RegLossParam {
    scale_pos_weight: string;
}

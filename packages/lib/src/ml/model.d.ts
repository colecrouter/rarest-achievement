/*
    This file represents the structure of a JSON-exported scikit-learn model.
*/

export type Features = {
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

export interface SearchResults {
	learner: Learner;
	version: number[];
}

export interface Learner {
	attributes: Attributes;
	feature_names: Array<keyof Features>;
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

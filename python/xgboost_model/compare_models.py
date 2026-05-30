from __future__ import annotations

import argparse
import json
from pathlib import Path

from training_utils import DERIVED_FEATURES, RICH_FEATURES, evaluate_model, load_training_data


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CSV_PATH = BASE_DIR / "input" / "steam_data.csv"
DEFAULT_OUTPUT_DIR = BASE_DIR / "output"


CONFIGS = [
    {
        "name": "baseline_raw",
        "feature_set": "current",
        "target_transform": "raw",
    },
    {
        "name": "current_log",
        "feature_set": "current",
        "target_transform": "log1p",
    },
    {
        "name": "derived_log",
        "feature_set": "derived",
        "target_transform": "log1p",
    },
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare ownership estimation model variants.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV_PATH, help="Training CSV path.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory for comparison artifacts.")
    parser.add_argument("--splits", type=int, default=5, help="KFold split count.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    df = load_training_data(args.csv)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    configs = list(CONFIGS)
    rich_only_features = set(RICH_FEATURES) - set(DERIVED_FEATURES)
    if any(column in df.columns for column in rich_only_features):
        configs.append(
            {
                "name": "rich_log",
                "feature_set": "rich",
                "target_transform": "log1p",
            }
        )

    results = [evaluate_model(df, splits=args.splits, **config) for config in configs]

    summary = {
        result.name: {
            "feature_set": result.feature_set,
            "target_transform": result.target_transform,
            **result.metrics,
        }
        for result in results
    }

    predictions = results[0].predictions
    for result in results[1:]:
        predictions = predictions.merge(result.predictions, on=["app_id", "actual_ownership"], how="outer")

    best_by_absolute_error = predictions.copy()
    prediction_columns = [f"{result.name}_absolute_error" for result in results]
    best_by_absolute_error["best_model"] = best_by_absolute_error[prediction_columns].idxmin(axis=1).str.replace(
        "_absolute_error", "", regex=False
    )
    best_by_absolute_error = best_by_absolute_error.sort_values(
        "derived_log_absolute_error" if "derived_log_absolute_error" in best_by_absolute_error else prediction_columns[0],
        ascending=False,
    )

    with (args.output_dir / "model_comparison_summary.json").open("w", encoding="utf-8") as fp:
        json.dump(summary, fp, indent=2)

    predictions.to_csv(args.output_dir / "model_comparison_predictions.csv", index=False)
    best_by_absolute_error.to_csv(args.output_dir / "model_comparison_ranked.csv", index=False)

    print(json.dumps(summary, indent=2))
    print(f"Wrote predictions to {args.output_dir / 'model_comparison_predictions.csv'}")
    print(f"Wrote ranked errors to {args.output_dir / 'model_comparison_ranked.csv'}")


if __name__ == "__main__":
    main()

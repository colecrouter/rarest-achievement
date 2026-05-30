from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import KFold


CURRENT_FEATURES = [
    "total_reviews",
    "review_score",
    "is_free",
    "price",
    "all_time_peak",
    "avg_count",
    "day_peak",
    "release_date_numeric",
]

DERIVED_FEATURES = CURRENT_FEATURES + [
    "release_age_days",
    "log_total_reviews",
    "log_price",
    "log_all_time_peak",
    "log_avg_count",
    "log_day_peak",
    "avg_to_all_time_peak",
    "day_to_all_time_peak",
    "reviews_per_day",
]

RICH_FEATURES = DERIVED_FEATURES + [
    "positive_reviews",
    "negative_reviews",
    "positive_ratio",
    "players_forever",
    "players_2weeks",
    "steamspy_ccu",
]


@dataclass(frozen=True)
class EvaluationResult:
    name: str
    feature_set: str
    target_transform: str
    metrics: dict[str, float]
    predictions: pd.DataFrame


def load_training_data(csv_file: Path) -> pd.DataFrame:
    if not csv_file.exists():
        raise FileNotFoundError(f"Dataset not found at {csv_file}")

    df = pd.read_csv(csv_file)
    df = df.dropna(subset=["ownership"]).copy()
    df["ownership"] = pd.to_numeric(df["ownership"], errors="coerce")
    return df.dropna(subset=["ownership"])


def prepare_frame(df: pd.DataFrame) -> pd.DataFrame:
    prepared = df.copy()

    if "is_free" in prepared.columns:
        prepared["is_free"] = prepared["is_free"].map(
            {True: True, False: False, "True": True, "False": False, "true": True, "false": False}
        )

    numeric_columns = [
        "total_reviews",
        "review_score",
        "price",
        "all_time_peak",
        "avg_count",
        "day_peak",
        "positive_reviews",
        "negative_reviews",
        "players_forever",
        "players_2weeks",
        "steamspy_ccu",
    ]
    for column in numeric_columns:
        if column in prepared.columns:
            prepared[column] = pd.to_numeric(prepared[column], errors="coerce")

    prepared["release_date_parsed"] = pd.to_datetime(prepared["release_date"], errors="coerce")
    prepared["release_date_numeric"] = (
        (prepared["release_date_parsed"] - pd.Timestamp("1970-01-01")) // pd.Timedelta("1s")
    )

    latest_release = prepared["release_date_parsed"].max()
    if pd.isna(latest_release):
        latest_release = pd.Timestamp.today()
    prepared["release_age_days"] = (latest_release - prepared["release_date_parsed"]).dt.days

    prepared["is_free"] = prepared["is_free"].fillna(False).astype(int)

    for column in ["total_reviews", "price", "all_time_peak", "avg_count", "day_peak"]:
        prepared[f"log_{column}"] = np.log1p(prepared[column].clip(lower=0))

    prepared["avg_to_all_time_peak"] = safe_ratio(prepared["avg_count"], prepared["all_time_peak"])
    prepared["day_to_all_time_peak"] = safe_ratio(prepared["day_peak"], prepared["all_time_peak"])
    prepared["reviews_per_day"] = safe_ratio(prepared["total_reviews"], prepared["release_age_days"].clip(lower=1))

    if "positive_reviews" in prepared.columns and "negative_reviews" in prepared.columns:
        total_review_count = prepared["positive_reviews"] + prepared["negative_reviews"]
        prepared["positive_ratio"] = safe_ratio(prepared["positive_reviews"], total_review_count)

    return prepared


def safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    denominator = denominator.replace(0, np.nan)
    return numerator / denominator


def select_features(df: pd.DataFrame, feature_set: str) -> tuple[pd.DataFrame, pd.Series]:
    prepared = prepare_frame(df)

    if feature_set == "current":
        feature_names = CURRENT_FEATURES
    elif feature_set == "derived":
        feature_names = DERIVED_FEATURES
    elif feature_set == "rich":
        feature_names = [feature for feature in RICH_FEATURES if feature in prepared.columns]
    else:
        raise ValueError(f"Unknown feature set: {feature_set}")

    filtered = prepared.copy()
    filtered = filtered[~((filtered["is_free"] == 0) & filtered["price"].isna())]
    X = filtered.reindex(columns=feature_names).fillna(-1)
    y = filtered["ownership"]
    return X, y


def transform_target(y: pd.Series, target_transform: str) -> pd.Series:
    if target_transform == "raw":
        return y
    if target_transform == "log1p":
        return np.log1p(y)
    raise ValueError(f"Unknown target transform: {target_transform}")


def inverse_target(y: np.ndarray, target_transform: str) -> np.ndarray:
    if target_transform == "raw":
        return y
    if target_transform == "log1p":
        return np.expm1(y)
    raise ValueError(f"Unknown target transform: {target_transform}")


def train_booster(X: pd.DataFrame, y: pd.Series, target_transform: str = "raw") -> xgb.Booster:
    dtrain = xgb.DMatrix(X, label=transform_target(y, target_transform), feature_names=list(X.columns))
    params = {
        "objective": "reg:squarederror",
        "eval_metric": "rmse",
        "max_depth": 3,
        "eta": 0.08,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "seed": 42,
    }
    return xgb.train(params, dtrain, num_boost_round=160)


def evaluate_model(
    df: pd.DataFrame,
    name: str,
    feature_set: str,
    target_transform: str,
    splits: int = 5,
) -> EvaluationResult:
    X, y = select_features(df, feature_set)
    n_splits = min(splits, len(X))
    if n_splits < 2:
        raise ValueError("At least two training rows are required for comparison")

    predictions = np.zeros(len(X))
    kfold = KFold(n_splits=n_splits, shuffle=True, random_state=42)

    for train_index, test_index in kfold.split(X):
        X_train = X.iloc[train_index]
        y_train = y.iloc[train_index]
        X_test = X.iloc[test_index]
        model = train_booster(X_train, y_train, target_transform)
        fold_predictions = model.predict(xgb.DMatrix(X_test, feature_names=list(X.columns)))
        predictions[test_index] = np.maximum(0, inverse_target(fold_predictions, target_transform))

    metrics = calculate_metrics(y.to_numpy(), predictions)
    output = pd.DataFrame(
        {
            "app_id": df.loc[X.index, "app_id"].to_numpy(),
            "actual_ownership": y.to_numpy(),
            f"{name}_prediction": predictions,
            f"{name}_absolute_error": np.abs(predictions - y.to_numpy()),
        }
    )
    return EvaluationResult(name, feature_set, target_transform, metrics, output)


def calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    error = predicted - actual
    abs_error = np.abs(error)
    smape_denominator = (np.abs(actual) + np.abs(predicted)) / 2
    smape = np.mean(np.divide(abs_error, smape_denominator, out=np.zeros_like(abs_error), where=smape_denominator != 0))
    return {
        "rmse": float(np.sqrt(np.mean(error**2))),
        "mae": float(np.mean(abs_error)),
        "median_absolute_error": float(np.median(abs_error)),
        "smape": float(smape),
    }

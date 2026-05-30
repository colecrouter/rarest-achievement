from __future__ import annotations

import argparse
import csv
import json
import random
import time
from pathlib import Path
from typing import Any

import requests


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT = BASE_DIR / "input" / "steam_data.csv"

OUTPUT_FIELDS = [
    "app_id",
    "name",
    "total_reviews",
    "review_score",
    "is_free",
    "price",
    "release_date",
    "all_time_peak",
    "avg_count",
    "day_peak",
    "ownership",
    "owner_range",
    "owners_lower",
    "owners_upper",
    "owner_bucket",
    "activity_bucket",
    "review_bucket",
    "positive_reviews",
    "negative_reviews",
    "players_forever",
    "players_2weeks",
    "steamspy_ccu",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a stratified Steam ownership training dataset.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="CSV output path.")
    parser.add_argument("--sample-per-bucket", type=int, default=8, help="Maximum apps sampled from each bucket.")
    parser.add_argument("--max-apps", type=int, default=160, help="Maximum app details to fetch after sampling.")
    parser.add_argument("--pages", type=int, default=5, help="SteamSpy catalog pages to scan; each page is up to 1000 apps.")
    parser.add_argument("--seed", type=int, default=42, help="Sampling seed.")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between per-app fetches.")
    parser.add_argument(
        "--metadata-output",
        type=Path,
        help="Optional metadata JSON path. Defaults to the CSV path with a .metadata.json suffix.",
    )
    return parser.parse_args()


def parse_owner_range(value: Any) -> int | None:
    if value is None:
        return None

    if isinstance(value, (int, float)):
        return int(value)

    parts = str(value).replace(",", "").split("..")
    if len(parts) != 2:
        return None

    try:
        lower = int(parts[0].strip())
        upper = int(parts[1].strip())
    except ValueError:
        return None

    return (lower + upper) // 2


def fetch_store_data(app_id: int) -> dict[str, Any]:
    response = requests.get(
        "https://store.steampowered.com/api/appdetails",
        params={"appids": app_id, "cc": "us", "l": "en"},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    app_data = data.get(str(app_id), {}).get("data", {}) or {}
    is_free = app_data.get("is_free", False)
    price = None
    if not is_free:
        price = (app_data.get("price_overview") or {}).get("final")
    return {
        "is_free": is_free,
        "price": price,
        "release_date": (app_data.get("release_date") or {}).get("date"),
    }


def fetch_review_data(app_id: int) -> dict[str, Any]:
    response = requests.get(
        f"https://store.steampowered.com/appreviews/{app_id}",
        params={"json": 1, "num_per_page": 0},
        timeout=30,
    )
    response.raise_for_status()
    summary = response.json().get("query_summary", {})
    return {
        "total_reviews": summary.get("total_reviews"),
        "review_score": summary.get("review_score"),
    }


def fetch_chart_data(app_id: int) -> dict[str, Any]:
    response = requests.get(f"https://steamcharts.com/app/{app_id}/chart-data.json", timeout=30)
    response.raise_for_status()
    data = response.json()
    counts = [entry[1] for entry in data]
    if not counts:
        return {
            "all_time_peak": None,
            "avg_count": None,
            "day_peak": None,
        }

    last_timestamp = data[-1][0] / 1000
    threshold = last_timestamp - 24 * 60 * 60
    counts_24h = [entry[1] for entry in data if entry[0] / 1000 >= threshold]
    return {
        "all_time_peak": max(counts),
        "avg_count": sum(counts) / len(counts),
        "day_peak": max(counts_24h) if counts_24h else None,
    }


def fetch_steamspy_catalog(pages: int) -> dict[str, Any]:
    catalog = {}
    for page in range(pages):
        response = requests.get("https://steamspy.com/api.php", params={"request": "all", "page": page}, timeout=60)
        response.raise_for_status()
        page_data = response.json()
        if not page_data:
            break
        catalog.update(page_data)
        print(f"Fetched SteamSpy catalog page {page} ({len(page_data)} apps)")
        if len(page_data) < 1000:
            break
    return catalog


def fetch_steamspy_details(app_id: int) -> dict[str, Any]:
    response = requests.get(
        "https://steamspy.com/api.php",
        params={"request": "appdetails", "appid": app_id},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def owner_bounds(value: str | None) -> tuple[int | None, int | None]:
    if not value:
        return None, None
    parts = value.replace(",", "").split("..")
    if len(parts) != 2:
        return None, None
    try:
        return int(parts[0].strip()), int(parts[1].strip())
    except ValueError:
        return None, None


def owner_bucket(ownership: int | None) -> str:
    if ownership is None:
        return "unknown"
    if ownership < 20_000:
        return "lt_20k"
    if ownership < 100_000:
        return "20k_100k"
    if ownership < 500_000:
        return "100k_500k"
    if ownership < 2_000_000:
        return "500k_2m"
    if ownership < 10_000_000:
        return "2m_10m"
    return "gte_10m"


def activity_bucket(ccu: int | None, players_2weeks: int | None) -> str:
    activity = ccu if ccu is not None else players_2weeks
    if activity is None:
        return "unknown"
    if activity == 0:
        return "zero"
    if activity < 50:
        return "lt_50"
    if activity < 500:
        return "50_500"
    if activity < 5_000:
        return "500_5k"
    return "gte_5k"


def review_bucket(review_count: int | None) -> str:
    if review_count is None:
        return "unknown"
    if review_count < 100:
        return "lt_100"
    if review_count < 1_000:
        return "100_1k"
    if review_count < 10_000:
        return "1k_10k"
    if review_count < 100_000:
        return "10k_100k"
    return "gte_100k"


def to_int(value: Any) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def catalog_candidates(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = []
    for raw_app_id, data in catalog.items():
        app_id = to_int(data.get("appid", raw_app_id))
        if app_id is None:
            continue
        owners = data.get("owners")
        ownership = parse_owner_range(owners)
        positive = to_int(data.get("positive"))
        negative = to_int(data.get("negative"))
        ccu = to_int(data.get("ccu"))
        players_2weeks = to_int(data.get("players_2weeks"))
        review_count = None if positive is None or negative is None else positive + negative
        candidates.append(
            {
                "app_id": app_id,
                "name": data.get("name", ""),
                "owner_range": owners,
                "ownership": ownership,
                "owner_bucket": owner_bucket(ownership),
                "activity_bucket": activity_bucket(ccu, players_2weeks),
                "review_bucket": review_bucket(review_count),
                "positive_reviews": positive,
                "negative_reviews": negative,
                "players_forever": to_int(data.get("players_forever")),
                "players_2weeks": players_2weeks,
                "steamspy_ccu": ccu,
            }
        )
    return candidates


def sample_candidates(candidates: list[dict[str, Any]], sample_per_bucket: int, max_apps: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    buckets: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    for candidate in candidates:
        key = (candidate["owner_bucket"], candidate["activity_bucket"], candidate["review_bucket"])
        buckets.setdefault(key, []).append(candidate)

    sampled = []
    for bucket_candidates in buckets.values():
        rng.shuffle(bucket_candidates)
        sampled.extend(bucket_candidates[:sample_per_bucket])

    rng.shuffle(sampled)
    return sampled[:max_apps]


def build_row(candidate: dict[str, Any]) -> dict[str, Any]:
    app_id = candidate["app_id"]
    store_data = {}
    try:
        store_data = fetch_store_data(app_id)
    except Exception as exc:
        print(f"Error fetching store data for app {app_id}: {exc}")

    review_data = {}
    try:
        review_data = fetch_review_data(app_id)
    except Exception as exc:
        print(f"Error fetching review data for app {app_id}: {exc}")

    chart_data = {}
    try:
        chart_data = fetch_chart_data(app_id)
    except Exception as exc:
        print(f"Error fetching chart data for app {app_id}: {exc}")

    details = {}
    try:
        details = fetch_steamspy_details(app_id)
    except Exception as exc:
        print(f"Error fetching SteamSpy details for app {app_id}: {exc}")

    owners = details.get("owners") or candidate["owner_range"]
    lower, upper = owner_bounds(owners)
    ownership = parse_owner_range(owners) or candidate["ownership"]
    positive = to_int(details.get("positive")) or candidate["positive_reviews"]
    negative = to_int(details.get("negative")) or candidate["negative_reviews"]
    review_count = None if positive is None or negative is None else positive + negative

    return {
        "app_id": app_id,
        "name": details.get("name") or candidate["name"],
        "total_reviews": review_data.get("total_reviews"),
        "review_score": review_data.get("review_score"),
        "is_free": store_data.get("is_free"),
        "price": store_data.get("price"),
        "release_date": store_data.get("release_date"),
        "all_time_peak": chart_data.get("all_time_peak"),
        "avg_count": chart_data.get("avg_count"),
        "day_peak": chart_data.get("day_peak"),
        "ownership": ownership,
        "owner_range": owners,
        "owners_lower": lower,
        "owners_upper": upper,
        "owner_bucket": owner_bucket(ownership),
        "activity_bucket": activity_bucket(to_int(details.get("ccu")) or candidate["steamspy_ccu"], to_int(details.get("players_2weeks")) or candidate["players_2weeks"]),
        "review_bucket": review_bucket(review_count),
        "positive_reviews": positive,
        "negative_reviews": negative,
        "players_forever": to_int(details.get("players_forever")) or candidate["players_forever"],
        "players_2weeks": to_int(details.get("players_2weeks")) or candidate["players_2weeks"],
        "steamspy_ccu": to_int(details.get("ccu")) or candidate["steamspy_ccu"],
    }


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    metadata_output = args.metadata_output or args.output.with_suffix(".metadata.json")

    catalog = fetch_steamspy_catalog(args.pages)
    candidates = catalog_candidates(catalog)
    sampled = sample_candidates(candidates, args.sample_per_bucket, args.max_apps, args.seed)
    print(f"Sampled {len(sampled)} apps from {len(candidates)} SteamSpy catalog entries")

    with args.output.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(fp, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for index, candidate in enumerate(sampled, start=1):
            row = build_row(candidate)
            writer.writerow(row)
            print(f"[{index}/{len(sampled)}] wrote app {candidate['app_id']} ({row['owner_bucket']})")
            time.sleep(args.delay)

    print(f"Wrote bucketed data to {args.output}")

    metadata = {
        "source": "SteamSpy catalog/appdetails, Steam store appdetails/reviews, SteamCharts chart-data",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pages": args.pages,
        "sample_per_bucket": args.sample_per_bucket,
        "max_apps": args.max_apps,
        "seed": args.seed,
        "row_count": len(sampled),
        "owner_buckets": sorted({candidate["owner_bucket"] for candidate in sampled}),
        "activity_buckets": sorted({candidate["activity_bucket"] for candidate in sampled}),
        "review_buckets": sorted({candidate["review_bucket"] for candidate in sampled}),
    }
    with metadata_output.open("w", encoding="utf-8") as fp:
        json.dump(metadata, fp, indent=2)
    print(f"Wrote metadata to {metadata_output}")


if __name__ == "__main__":
    main()

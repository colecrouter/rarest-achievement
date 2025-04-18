import requests
import csv
import time
from datetime import datetime, timedelta
import os

def fetch_store_data(app_id):
    url = f"https://store.steampowered.com/api/appdetails?appids={app_id}&cc=us&l=en"
    try:
        response = requests.get(url)
        data = response.json()
        # print the response for debugging
        # print(data)
        app_data = data.get(str(app_id), {}).get('data', {})
        is_free = app_data.get('is_free', False)
        price = None
        if not is_free:
            price_overview = app_data.get('price_overview', {})
            price = price_overview.get('final', None)
        release_date = app_data.get('release_date', {}).get('date', None)
        return {
            'is_free': is_free,
            'price': price,
            'release_date': release_date
        }
    except Exception as e:
        print(f"Error fetching store data for app {app_id}: {e}")
        return {}

def fetch_review_data(app_id):
    url = f"https://store.steampowered.com/appreviews/{app_id}?json=1"
    try:
        response = requests.get(url)
        data = response.json()
        query_summary = data.get('query_summary', {})
        total_reviews = query_summary.get('total_reviews', None)
        review_score = query_summary.get('review_score', None)
        return {
            'total_reviews': total_reviews,
            'review_score': review_score
        }
    except Exception as e:
        print(f"Error fetching reviews data for app {app_id}: {e}")
        return {}

def fetch_chart_data(app_id):
    url = f"https://steamcharts.com/app/{app_id}/chart-data.json"
    try:
        response = requests.get(url)
        data = response.json()  # list of [ms_timestamp, count]
        counts = [entry[1] for entry in data]
        if counts:
            all_time_peak = max(counts)
            avg_count = sum(counts) / len(counts)
            # Calculate 24-hour peak relative to the last timestamp
            last_timestamp = data[-1][0] / 1000.0  # convert ms to seconds
            threshold = last_timestamp - 24*3600
            counts_24h = [entry[1] for entry in data if (entry[0]/1000.0) >= threshold]
            day_peak = max(counts_24h) if counts_24h else None
        else:
            all_time_peak = avg_count = day_peak = None
        return {
            'all_time_peak': all_time_peak,
            'avg_count': avg_count,
            'day_peak': day_peak
        }
    except Exception as e:
        print(f"Error fetching chart data for app {app_id}: {e}")
        return {}

def generate_csv(app_ids, output_file):
    headers = ['app_id', 'total_reviews', 'review_score', 'is_free', 'price', 'release_date', 'all_time_peak', 'avg_count', 'day_peak', 'ownership']
    # Read existing data if file exists
    existing = {}
    if os.path.exists(output_file):
        with open(output_file, 'r', newline='', encoding='utf-8') as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                existing[row['app_id']] = row
    # Generate new data and update existing rows (or add new ones)
    for app_id in app_ids:
        review_data = fetch_review_data(app_id)
        store_data = fetch_store_data(app_id)
        chart_data = fetch_chart_data(app_id)
        new_row = {
            'app_id': str(app_id),
            'total_reviews': review_data.get('total_reviews'),
            'review_score': review_data.get('review_score'),
            'is_free': store_data.get('is_free'),
            'price': store_data.get('price'),
            'release_date': store_data.get('release_date'),
            'all_time_peak': chart_data.get('all_time_peak'),
            'avg_count': chart_data.get('avg_count'),
            'day_peak': chart_data.get('day_peak'),
            'ownership': ''  # preserve existing ownership data if previously set
        }
        existing[str(app_id)] = new_row
        time.sleep(1)  # avoid rate limits
    # Write merged data back to CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as fp:
        writer = csv.DictWriter(fp, fieldnames=headers)
        writer.writeheader()
        for row in existing.values():
            writer.writerow(row)

if __name__ == '__main__':
    app_ids = [  2767030 ]
    
    output_file = 'steam_data.csv'
    generate_csv(app_ids, output_file)
    print("Data generation complete. See", output_file)

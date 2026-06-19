"""
Sync riders from ProCyclingStats locally, then push to production.

Usage (from repo root, with backend venv active):
    python scripts/push_riders.py --url https://fantasy-cycling-backend.onrender.com --secret YOUR_SECRET

Options:
    --url       Production backend base URL
    --secret    Value of SYNC_SECRET env var on the server
    --limit N   Only sync first N riders (useful for testing)
"""

import argparse
import json
import os
import sys

import django

# Bootstrap Django so we can call the management command internals directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

import requests
from django.utils import timezone
from api.management.commands.sync_riders import Command as SyncCommand
import cloudscraper


def collect_riders(limit=None):
    cmd = SyncCommand()
    session = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )

    print("Fetching current season ranking...")
    current_date = cmd._latest_date(session)
    current_data = cmd._fetch_ranking(session, current_date, limit)
    print(f"  -> {len(current_data)} riders (current season, date={current_date})")

    print("Fetching previous season ranking (2025-12-31)...")
    prev_data = cmd._fetch_ranking(session, "2025-12-31", limit)
    print(f"  -> {len(prev_data)} riders (previous season)")

    current_by_url = {r["rider_url"]: r for r in current_data}
    prev_by_url = {r["rider_url"]: r for r in prev_data}
    all_urls = set(current_by_url) | set(prev_by_url)

    riders = []
    for url in all_urls:
        curr = current_by_url.get(url, {})
        prev = prev_by_url.get(url, {})
        source = curr or prev
        riders.append({
            "pcs_url": url,
            "name": source.get("rider_name", ""),
            "team": source.get("team_name", ""),
            "nationality": source.get("nationality", ""),
            "current_year_points": curr.get("points", 0) if curr else 0,
            "prev_year_points": prev.get("points", 0) if prev else 0,
        })

    return riders


def push_riders(riders, base_url, secret, batch_size=200):
    url = f"{base_url.rstrip('/')}/api/admin/push-riders/?secret={secret}"
    print(f"\nPushing {len(riders)} riders to {base_url} in batches of {batch_size}...")
    total_created = total_updated = 0
    for i in range(0, len(riders), batch_size):
        batch = riders[i:i + batch_size]
        print(f"  Batch {i // batch_size + 1}: riders {i + 1}–{i + len(batch)}", end=" ... ", flush=True)
        resp = requests.post(url, json=batch, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        total_created += result["created"]
        total_updated += result["updated"]
        print(f"created={result['created']} updated={result['updated']}")
    print(f"\nDone. Created: {total_created}, Updated: {total_updated}, Total: {total_created + total_updated}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Production backend base URL")
    parser.add_argument("--secret", required=True, help="SYNC_SECRET value")
    parser.add_argument("--limit", type=int, default=None, help="Limit riders fetched (for testing)")
    args = parser.parse_args()

    riders = collect_riders(limit=args.limit)
    push_riders(riders, args.url, args.secret)

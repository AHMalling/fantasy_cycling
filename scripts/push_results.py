"""
Sync race results from ProCyclingStats locally, then push to production.

Rider list is fetched from the production API so no local DB is needed.
Run this from your local machine (not from a server) to avoid PCS IP blocks.

Usage (from repo root, with backend venv active):
    python scripts/push_results.py --url https://your-backend.onrender.com --secret YOUR_SECRET

Options:
    --url       Production backend base URL
    --secret    Value of SYNC_SECRET env var on the server
    --year N    Season year to sync (default: current year)
    --limit N   Only process first N riders (useful for testing)
"""

import argparse
import datetime
import sys
import time

import cloudscraper
import requests
from procyclingstats import RiderResults

REQUEST_DELAY = 1.5  # seconds between PCS requests
PUSH_BATCH_SIZE = 500


def fetch_all_riders(base_url):
    riders = []
    url = f"{base_url.rstrip('/')}/api/riders/?ordering=name"
    while url:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        riders.extend(data.get("results", []))
        url = data.get("next")
    return riders


def scrape_rider_results(session, pcs_url, year):
    results_url = f"https://www.procyclingstats.com/{pcs_url}/results/{year}"
    resp = session.get(results_url, timeout=15)
    resp.raise_for_status()
    rr = RiderResults(f"{pcs_url}/results/{year}", html=resp.text, update_html=False)
    rows = rr.results("date", "rank", "stage_name", "stage_url", "uci_points", "class")
    return [r for r in rows if r.get("rank") is not None and (r.get("uci_points") or 0) > 0]


def push_results(results, base_url, secret):
    url = f"{base_url.rstrip('/')}/api/admin/push-results/?secret={secret}"
    total_created = total_updated = total_skipped = 0
    for i in range(0, len(results), PUSH_BATCH_SIZE):
        batch = results[i : i + PUSH_BATCH_SIZE]
        batch_num = i // PUSH_BATCH_SIZE + 1
        print(f"  Pushing batch {batch_num} ({len(batch)} results)…", end=" ", flush=True)
        resp = requests.post(url, json=batch, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        total_created += data["created"]
        total_updated += data["updated"]
        total_skipped += data.get("skipped", 0)
        print(f"created={data['created']} updated={data['updated']}")
    return total_created, total_updated, total_skipped


def main():
    parser = argparse.ArgumentParser(description="Push race results to production")
    parser.add_argument("--url", required=True, help="Production backend base URL")
    parser.add_argument("--secret", required=True, help="SYNC_SECRET value")
    parser.add_argument("--year", type=int, default=datetime.date.today().year)
    parser.add_argument("--limit", type=int, default=None, help="Limit number of riders (for testing)")
    args = parser.parse_args()

    print(f"Fetching rider list from {args.url}…")
    riders = fetch_all_riders(args.url)
    if args.limit:
        riders = riders[: args.limit]
    riders = [r for r in riders if r.get("pcs_url")]
    print(f"  -> {len(riders)} riders to process (year={args.year})")

    session = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )

    all_results = []
    failed = 0

    for i, rider in enumerate(riders, 1):
        pcs_url = rider["pcs_url"]
        name = rider.get("name", pcs_url)
        try:
            rows = scrape_rider_results(session, pcs_url, args.year)
            for row in rows:
                if not row.get("date") or not row.get("stage_name"):
                    continue
                all_results.append({
                    "rider_pcs_url": pcs_url,
                    "date": row["date"],
                    "race_name": (row.get("stage_name") or "").strip(),
                    "race_url": (row.get("stage_url") or "").strip(),
                    "uci_points": row.get("uci_points") or 0,
                    "rank": row.get("rank"),
                    "category": (row.get("class") or "").strip(),
                    "year": args.year,
                })
            print(f"  [{i}/{len(riders)}] {name}: {len(rows)} results")
        except Exception as exc:
            failed += 1
            print(f"  [{i}/{len(riders)}] {name}: FAILED — {exc}", file=sys.stderr)

        if i < len(riders):
            time.sleep(REQUEST_DELAY)

    print(f"\nCollected {len(all_results)} results from {len(riders) - failed} riders ({failed} failed).")

    if not all_results:
        print("Nothing to push.")
        return

    print(f"Pushing to {args.url}…")
    created, updated, skipped = push_results(all_results, args.url, args.secret)
    print(f"\nDone. Created: {created}, Updated: {updated}, Skipped: {skipped}")


if __name__ == "__main__":
    main()

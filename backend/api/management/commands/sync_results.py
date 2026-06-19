"""
Management command to sync per-race UCI results for riders from ProCyclingStats.

This populates the RaceResult table, which powers the race breakdown view on
each team's detail page.  Run weekly or after major race weekends.

Usage:
    python manage.py sync_results                    # all riders, current year
    python manage.py sync_results --limit 50         # first 50 riders only
    python manage.py sync_results --year 2025        # a past season
    python manage.py sync_results --rider-pk 42      # single rider (for testing)
"""

import datetime
import logging
import time

import cloudscraper
from django.core.management.base import BaseCommand
from procyclingstats import RiderResults

from api.models import RaceResult, Rider

logger = logging.getLogger(__name__)

REQUEST_DELAY = 1.5  # seconds between requests


class Command(BaseCommand):
    help = "Sync per-race UCI results for all riders from ProCyclingStats"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=None, help="Max number of riders to process")
        parser.add_argument("--year", type=int, default=None, help="Season year (default: current year)")
        parser.add_argument("--rider-pk", type=int, default=None, help="Process a single rider by PK")

    def handle(self, *args, **options):
        year = options["year"] or datetime.date.today().year

        if options["rider_pk"]:
            riders = list(Rider.objects.filter(pk=options["rider_pk"]))
        else:
            qs = Rider.objects.filter(pcs_url__startswith="rider/").order_by("id")
            if options["limit"]:
                qs = qs[: options["limit"]]
            riders = list(qs)

        total = len(riders)
        if total == 0:
            self.stdout.write("No riders found.")
            return

        self.stdout.write(f"Syncing race results for {total} riders (year={year})…")

        session = cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "desktop": True}
        )

        created_total = updated_total = failed = 0

        for i, rider in enumerate(riders, 1):
            try:
                results_url = f"https://www.procyclingstats.com/{rider.pcs_url}/results/{year}"
                resp = session.get(results_url, timeout=15)
                resp.raise_for_status()

                rr = RiderResults(
                    f"{rider.pcs_url}/results/{year}",
                    html=resp.text,
                    update_html=False,
                )
                rows = rr.results("date", "rank", "stage_name", "stage_url", "uci_points", "class")
                scored = [
                    r for r in rows
                    if r.get("rank") is not None and (r.get("uci_points") or 0) > 0
                ]

                rider_created = rider_updated = 0
                for row in scored:
                    date_str = row.get("date")
                    if not date_str:
                        continue
                    try:
                        result_date = datetime.date.fromisoformat(date_str)
                    except ValueError:
                        continue

                    race_name = (row.get("stage_name") or "").strip()
                    if not race_name:
                        continue

                    _, created = RaceResult.objects.update_or_create(
                        rider=rider,
                        date=result_date,
                        race_name=race_name,
                        defaults={
                            "race_url": (row.get("stage_url") or "").strip(),
                            "uci_points": row.get("uci_points") or 0,
                            "rank": row.get("rank"),
                            "category": (row.get("class") or "").strip(),
                            "year": year,
                        },
                    )
                    if created:
                        rider_created += 1
                    else:
                        rider_updated += 1

                created_total += rider_created
                updated_total += rider_updated
                self.stdout.write(
                    f"  [{i}/{total}] {rider.name}: {len(scored)} results "
                    f"(+{rider_created} new, ~{rider_updated} updated)"
                )

            except Exception as exc:
                failed += 1
                logger.debug("sync_results failed for %s: %s", rider.pcs_url, exc)
                self.stderr.write(f"  [{i}/{total}] {rider.name}: error — {exc}")

            if i < total:
                time.sleep(REQUEST_DELAY)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created: {created_total}, Updated: {updated_total}, Failed: {failed}"
            )
        )

"""
Management command to scrape rider profile photos from ProCyclingStats.

Only fetches photos for riders that don't have one yet.

Usage:
    python manage.py sync_photos           # all riders missing a photo
    python manage.py sync_photos --limit 50  # process at most 50 riders
"""

import logging
import time

import cloudscraper
from django.core.management.base import BaseCommand
from selectolax.parser import HTMLParser

from api.models import Rider

logger = logging.getLogger(__name__)

PCS_BASE = "https://www.procyclingstats.com"
REQUEST_DELAY = 1.5  # seconds between requests


class Command(BaseCommand):
    help = "Scrape rider profile photos from ProCyclingStats (skips riders that already have a photo)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Max number of riders to process (default: all missing photos)",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        qs = Rider.objects.filter(photo_url="", pcs_url__startswith="rider/").order_by("id")
        if limit:
            qs = qs[:limit]

        total = qs.count()
        if total == 0:
            self.stdout.write("All riders already have photos.")
            return

        self.stdout.write(f"Fetching photos for {total} riders…")

        session = cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "desktop": True}
        )

        updated = 0
        failed = 0

        for i, rider in enumerate(qs, 1):
            url = f"{PCS_BASE}/{rider.pcs_url}"
            try:
                resp = session.get(url, timeout=15)
                resp.raise_for_status()
                tree = HTMLParser(resp.text)

                photo_img = (
                    tree.css_first("div.rdrImg img")
                    or tree.css_first("img[src*='images/riders']")
                )
                if photo_img:
                    src = photo_img.attributes.get("src", "")
                    if src:
                        if not src.startswith("http"):
                            src = f"{PCS_BASE}/{src.lstrip('/')}"
                        rider.photo_url = src
                        rider.save(update_fields=["photo_url"])
                        updated += 1
                        self.stdout.write(f"  [{i}/{total}] {rider.name}: {src}")
                    else:
                        failed += 1
                        self.stdout.write(f"  [{i}/{total}] {rider.name}: no photo found")
                else:
                    failed += 1
                    self.stdout.write(f"  [{i}/{total}] {rider.name}: no photo element found")

            except Exception as exc:
                failed += 1
                logger.debug("Photo scrape failed for %s: %s", rider.pcs_url, exc)
                self.stderr.write(f"  [{i}/{total}] {rider.name}: error — {exc}")

            if i < total:
                time.sleep(REQUEST_DELAY)

        self.stdout.write(
            self.style.SUCCESS(f"Done. Updated: {updated}, Failed/missing: {failed}")
        )

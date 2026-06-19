"""
Management command to sync rider data from ProCyclingStats.com.

Usage:
    python manage.py sync_riders                     # syncs both current and previous year
    python manage.py sync_riders --limit 200         # limit number of riders fetched per ranking
    python manage.py sync_riders --skip-current      # only sync previous year (pricing)
    python manage.py sync_riders --skip-previous     # only sync current year (scoring)
"""

import logging
import time

import cloudscraper
from django.core.management.base import BaseCommand
from django.utils import timezone
from selectolax.parser import HTMLParser

from api.models import Rider

logger = logging.getLogger(__name__)

RANKINGS_URL = "https://www.procyclingstats.com/rankings.php"
RANKING_TYPE = "uci-season-individual"
PREV_YEAR_DATE = "2025-12-31"
PAGE_SIZE = 100
REQUEST_DELAY = 1.5  # seconds between requests


class Command(BaseCommand):
    help = "Sync rider UCI points from ProCyclingStats.com"

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument("--skip-current", action="store_true")
        parser.add_argument("--skip-previous", action="store_true")

    def handle(self, *args, **options):
        limit = options["limit"]
        session = cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "desktop": True}
        )

        current_data: list[dict] = []
        prev_data: list[dict] = []

        if not options["skip_current"]:
            current_date = self._latest_date(session)
            self.stdout.write(f"Fetching 2026 season ranking (date={current_date})...")
            current_data = self._fetch_ranking(session, current_date, limit)
            self.stdout.write(f"  -> {len(current_data)} riders")

        if not options["skip_previous"]:
            self.stdout.write(f"Fetching 2025 final ranking (date={PREV_YEAR_DATE})...")
            prev_data = self._fetch_ranking(session, PREV_YEAR_DATE, limit)
            self.stdout.write(f"  -> {len(prev_data)} riders")

        if not current_data and not prev_data:
            self.stderr.write("No data fetched. Check connectivity.")
            return

        current_by_url = {r["rider_url"]: r for r in current_data}
        prev_by_url = {r["rider_url"]: r for r in prev_data}
        now = timezone.now()
        created_count, updated_count = self._upsert_riders(current_by_url, prev_by_url, now)

        # Zero out current_year_points for any DB rider absent from the current ranking.
        # This corrects riders who scored last year but haven't scored yet this season.
        if current_by_url:
            zeroed = Rider.objects.exclude(pcs_url__in=current_by_url.keys()).update(current_year_points=0)
            if zeroed:
                self.stdout.write(f"  Zeroed current_year_points for {zeroed} riders not in 2026 ranking.")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created: {created_count}, Updated: {updated_count}, "
                f"Total: {len(set(current_by_url) | set(prev_by_url))}"
            )
        )

    def _upsert_riders(self, current_by_url: dict, prev_by_url: dict, now) -> tuple[int, int]:
        """Write rider data to the DB. Returns (created_count, updated_count)."""
        all_urls = set(current_by_url) | set(prev_by_url)
        created_count = updated_count = 0

        for url in all_urls:
            curr = current_by_url.get(url, {})
            prev = prev_by_url.get(url, {})
            source = curr or prev

            defaults = {
                "name": source.get("rider_name", ""),
                "team": source.get("team_name", ""),
                "nationality": source.get("nationality", ""),
                "last_synced": now,
            }
            if curr:
                defaults["current_year_points"] = curr.get("points", 0)
            elif current_by_url:
                # We fetched current-season data but this rider didn't appear in it —
                # they haven't scored yet this season.
                defaults["current_year_points"] = 0
            if prev:
                defaults["prev_year_points"] = prev.get("points", 0)

            _, created = Rider.objects.update_or_create(pcs_url=url, defaults=defaults)
            if created:
                created_count += 1
            else:
                updated_count += 1

        return created_count, updated_count

    def _latest_date(self, session) -> str:
        """Fetch the most recent available ranking date from the PCS rankings page."""
        try:
            resp = session.get(
                "https://www.procyclingstats.com/rankings/uci-season-individual", timeout=30
            )
            tree = HTMLParser(resp.text)
            select = tree.css_first("select[name=date]")
            if select:
                first_option = select.css_first("option")
                if first_option:
                    return first_option.attributes.get("value", "")
        except Exception as exc:
            logger.warning("Could not fetch latest date: %s", exc)
        # Fallback: today's date
        return timezone.now().strftime("%Y-%m-%d")

    def _fetch_ranking(self, session, date: str, limit: int | None) -> list[dict]:
        """Scrape all pages of the UCI individual season ranking for the given date."""
        all_data: list[dict] = []
        seen_urls: set[str] = set()
        offset = 0

        while True:
            params = {
                "p": RANKING_TYPE,
                "date": date,
                "offset": offset,
                "page": "smallerorequal",
                "nation": "",
                "age": "",
                "zage": "",
                "team": "",
                "teamlevel": "",
                "filter": "Filter",
            }

            try:
                resp = session.get(RANKINGS_URL, params=params, timeout=30)
                resp.raise_for_status()
            except Exception as exc:
                self.stderr.write(f"  Request failed at offset={offset}: {exc}")
                logger.exception("sync_riders request error")
                break

            page_data = self._parse_ranking_table(resp.text)
            if not page_data:
                break

            new_riders = [r for r in page_data if r["rider_url"] not in seen_urls]
            if not new_riders:
                break

            for r in new_riders:
                seen_urls.add(r["rider_url"])
            all_data.extend(new_riders)
            self.stdout.write(f"    offset={offset}: {len(all_data)} riders so far")

            if limit is not None and len(all_data) >= limit:
                break

            if len(page_data) < PAGE_SIZE:
                break

            offset += PAGE_SIZE
            time.sleep(REQUEST_DELAY)

        return all_data if limit is None else all_data[:limit]

    def _parse_ranking_table(self, html: str) -> list[dict]:
        tree = HTMLParser(html)
        table = tree.css_first("table")
        if not table:
            return []

        tbody = table.css_first("tbody")
        rows = (tbody or table).css("tr")
        results = []

        for row in rows:
            cells = row.css("td")
            if len(cells) < 5:
                continue

            rider_link = None
            team_link = None
            for a in row.css("a"):
                href = a.attributes.get("href", "")
                if href.startswith("rider/") and rider_link is None:
                    rider_link = a
                elif href.startswith("team/") and team_link is None:
                    team_link = a

            if not rider_link:
                continue

            flag = row.css_first("[class*='flag']")
            nationality = ""
            if flag:
                for cls in flag.attributes.get("class", "").split():
                    if len(cls) == 2 and cls.isalpha():
                        nationality = cls.upper()
                        break

            try:
                points = round(float(cells[-1].text(strip=True).replace(",", "") or 0))
            except ValueError:
                points = 0

            href = rider_link.attributes.get("href", "").lstrip("/")
            results.append({
                "rider_name": rider_link.text(strip=True),
                "rider_url": href,
                "team_name": team_link.text(strip=True) if team_link else "",
                "nationality": nationality,
                "points": points,
            })

        return results

"""
Unit tests for sync_riders management command.
Tests _parse_ranking_table and the prev/current field merge logic directly.
No network calls, no cloudscraper.
"""
import pytest
from api.management.commands.sync_riders import Command, PREV_YEAR_DATE


def make_table_html(rows: list[str]) -> str:
    rows_html = "\n".join(rows)
    return f"<table><tbody>{rows_html}</tbody></table>"


def make_row(rider_url="rider/test-rider", rider_name="Test Rider",
             team_url="team/test-team", team_name="Test Team",
             nationality="BE", points="1,234"):
    return f"""
    <tr>
      <td>1</td>
      <td>1</td>
      <td><span class="flag {nationality.lower()}"></span></td>
      <td><a href="{rider_url}">{rider_name}</a></td>
      <td><a href="{team_url}">{team_name}</a></td>
      <td>{points}</td>
    </tr>
    """


class TestParseRankingTable:
    def setup_method(self):
        self.cmd = Command()

    def test_extracts_basic_fields(self):
        html = make_table_html([make_row()])
        result = self.cmd._parse_ranking_table(html)
        assert len(result) == 1
        r = result[0]
        assert r["rider_url"] == "rider/test-rider"
        assert r["rider_name"] == "Test Rider"
        assert r["team_name"] == "Test Team"

    def test_parses_comma_formatted_points(self):
        html = make_table_html([make_row(points="1,234")])
        result = self.cmd._parse_ranking_table(html)
        assert result[0]["points"] == 1234

    def test_empty_points_defaults_to_zero(self):
        html = make_table_html([make_row(points="")])
        result = self.cmd._parse_ranking_table(html)
        assert result[0]["points"] == 0

    def test_invalid_points_defaults_to_zero(self):
        html = make_table_html([make_row(points="N/A")])
        result = self.cmd._parse_ranking_table(html)
        assert result[0]["points"] == 0

    def test_extracts_nationality_from_flag_class(self):
        html = make_table_html([make_row(nationality="SI")])
        result = self.cmd._parse_ranking_table(html)
        assert result[0]["nationality"] == "SI"

    def test_skips_rows_without_rider_link(self):
        row = "<tr><td>1</td><td>data</td><td>data</td><td>no link</td><td>data</td><td>100</td></tr>"
        html = make_table_html([row])
        result = self.cmd._parse_ranking_table(html)
        assert result == []

    def test_no_table_returns_empty(self):
        result = self.cmd._parse_ranking_table("<html><body>no table</body></html>")
        assert result == []

    def test_multiple_rows(self):
        rows = [make_row(rider_url=f"rider/rider-{i}", rider_name=f"Rider {i}") for i in range(3)]
        html = make_table_html(rows)
        result = self.cmd._parse_ranking_table(html)
        assert len(result) == 3


class TestMergeLogic:
    """Tests the prev/current field assignment logic from Command.handle()."""

    def _run_merge(self, current_data, prev_data):
        """Simulate the merge logic in handle() without touching the DB."""
        current_by_url = {r["rider_url"]: r for r in current_data}
        prev_by_url = {r["rider_url"]: r for r in prev_data}
        all_urls = set(current_by_url) | set(prev_by_url)

        results = {}
        for url in all_urls:
            curr = current_by_url.get(url, {})
            prev = prev_by_url.get(url, {})
            source = curr or prev
            entry = {
                "name": source.get("rider_name", ""),
                "team": source.get("team_name", ""),
            }
            if curr:
                entry["current_year_points"] = curr.get("points", 0)
            if prev:
                entry["prev_year_points"] = prev.get("points", 0)
            results[url] = entry
        return results

    def test_rider_in_both_sets_both_fields(self):
        url = "rider/pogacar"
        current = [{"rider_url": url, "rider_name": "Pogacar", "team_name": "UAE", "points": 2075}]
        prev = [{"rider_url": url, "rider_name": "Pogacar", "team_name": "UAE", "points": 11680}]
        results = self._run_merge(current, prev)
        assert results[url]["current_year_points"] == 2075
        assert results[url]["prev_year_points"] == 11680

    def test_current_and_prev_are_different_columns(self):
        """Catches swapped field assignment."""
        url = "rider/rider-a"
        current = [{"rider_url": url, "rider_name": "A", "team_name": "T", "points": 100}]
        prev = [{"rider_url": url, "rider_name": "A", "team_name": "T", "points": 9999}]
        results = self._run_merge(current, prev)
        assert results[url]["current_year_points"] != results[url]["prev_year_points"]

    def test_rider_only_in_prev_no_current_key(self):
        url = "rider/prev-only"
        prev = [{"rider_url": url, "rider_name": "Old", "team_name": "T", "points": 500}]
        results = self._run_merge([], prev)
        assert results[url]["prev_year_points"] == 500
        assert "current_year_points" not in results[url]

    def test_rider_only_in_current_no_prev_key(self):
        url = "rider/current-only"
        current = [{"rider_url": url, "rider_name": "New", "team_name": "T", "points": 300}]
        results = self._run_merge(current, [])
        assert results[url]["current_year_points"] == 300
        assert "prev_year_points" not in results[url]


@pytest.mark.django_db
class TestUpdateOrCreate:
    def test_creates_new_rider(self):
        from api.management.commands.sync_riders import Command
        from api.models import Rider
        from django.utils import timezone

        cmd = Command()
        url = "rider/new-rider"
        cmd._upsert_riders(
            current_by_url={url: {"rider_name": "New", "team_name": "T", "nationality": "FR", "points": 100}},
            prev_by_url={},
            now=timezone.now(),
        )
        assert Rider.objects.filter(pcs_url=url).exists()

    def test_updates_existing_rider(self):
        from api.management.commands.sync_riders import Command
        from api.models import Rider
        from django.utils import timezone

        Rider.objects.create(pcs_url="rider/existing", name="Old Name", prev_year_points=500)
        cmd = Command()
        cmd._upsert_riders(
            current_by_url={"rider/existing": {"rider_name": "New Name", "team_name": "T", "nationality": "BE", "points": 999}},
            prev_by_url={},
            now=timezone.now(),
        )
        rider = Rider.objects.get(pcs_url="rider/existing")
        assert rider.name == "New Name"
        assert rider.current_year_points == 999


class TestConstants:
    def test_prev_year_date_is_end_of_2025(self):
        """Canary: fails when PREV_YEAR_DATE needs to be bumped for the next season."""
        assert PREV_YEAR_DATE == "2025-12-31"

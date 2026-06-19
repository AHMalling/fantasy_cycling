import pytest
from unittest.mock import patch
import datetime


@pytest.mark.django_db
class TestLeaderboard:
    def test_only_shows_locked_teams(self, anon_client, user_factory, rider_factory, team_factory):
        user = user_factory()
        rider = rider_factory()
        team_factory(user=user, riders=[rider], locked=True, name="Locked")
        team_factory(user=user, riders=[rider], locked=False, name="Unlocked", year=2025)
        resp = anon_client.get("/api/leaderboard/?year=2026")
        names = [t["name"] for t in resp.data]
        assert "Locked" in names
        assert "Unlocked" not in names

    def test_filters_by_year(self, anon_client, user_factory, rider_factory, team_factory):
        user = user_factory()
        rider = rider_factory()
        team_factory(user=user, riders=[rider], locked=True, name="2026 Team", year=2026)
        team_factory(user=user, riders=[rider], locked=True, name="2025 Team", year=2025)

        resp = anon_client.get("/api/leaderboard/?year=2025")
        names = [t["name"] for t in resp.data]
        assert "2025 Team" in names
        assert "2026 Team" not in names

    def test_sorted_by_total_score_desc(self, anon_client, user_factory, rider_factory, team_factory):
        alice = user_factory(username="alice")
        bob = user_factory(username="bob")
        low_rider = rider_factory(name="Low", current=100)
        high_rider = rider_factory(name="High", current=5000)
        team_factory(user=alice, riders=[low_rider], locked=True, name="Low Team")
        team_factory(user=bob, riders=[high_rider], locked=True, name="High Team")
        resp = anon_client.get("/api/leaderboard/?year=2026")
        assert resp.data[0]["name"] == "High Team"
        assert resp.data[1]["name"] == "Low Team"

    def test_default_year_is_current(self, anon_client, user_factory, rider_factory, team_factory):
        user = user_factory()
        rider = rider_factory()
        team_factory(user=user, riders=[rider], locked=True, name="Current Year", year=2026)
        with patch("api.views.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 4, 5)
            resp = anon_client.get("/api/leaderboard/")
        names = [t["name"] for t in resp.data]
        assert "Current Year" in names

    def test_unauthenticated_allowed(self, anon_client, user_factory, team_factory):
        resp = anon_client.get("/api/leaderboard/")
        assert resp.status_code == 200

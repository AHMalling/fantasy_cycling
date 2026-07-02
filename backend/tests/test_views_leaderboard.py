import pytest
from unittest.mock import patch
import datetime

from api.models import TeamScoreSnapshot


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
            mock_dt.timedelta = datetime.timedelta
            resp = anon_client.get("/api/leaderboard/")
        names = [t["name"] for t in resp.data]
        assert "Current Year" in names

    def test_unauthenticated_allowed(self, anon_client, user_factory, team_factory):
        resp = anon_client.get("/api/leaderboard/")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestLeaderboardDeltas:
    def test_deltas_null_without_snapshots(self, anon_client, user_factory, rider_factory, team_factory):
        team_factory(user=user_factory(), riders=[rider_factory()], locked=True)
        resp = anon_client.get("/api/leaderboard/?year=2026")
        entry = resp.data[0]
        assert entry["score_delta"] is None
        assert entry["rank_delta"] is None
        assert entry["delta_since"] is None

    def test_score_and_rank_delta_vs_week_old_snapshot(
        self, anon_client, user_factory, rider_factory, team_factory
    ):
        # Alice: 5000 now, 4000 a week ago (was 2nd). Bob: 3000 now, 4500 a week ago (was 1st).
        alice_team = team_factory(
            user=user_factory(username="alice"),
            riders=[rider_factory(name="A", current=5000)],
            locked=True, name="Alice Team",
        )
        bob_team = team_factory(
            user=user_factory(username="bob"),
            riders=[rider_factory(name="B", current=3000)],
            locked=True, name="Bob Team",
        )
        week_ago = datetime.date.today() - datetime.timedelta(days=8)
        TeamScoreSnapshot.objects.create(team=alice_team, date=week_ago, total_score=4000, rank=2)
        TeamScoreSnapshot.objects.create(team=bob_team, date=week_ago, total_score=4500, rank=1)

        resp = anon_client.get("/api/leaderboard/?year=2026")
        by_name = {t["name"]: t for t in resp.data}

        assert by_name["Alice Team"]["score_delta"] == 1000
        assert by_name["Alice Team"]["rank_delta"] == 1  # moved up 2nd -> 1st
        assert by_name["Alice Team"]["delta_since"] == str(week_ago)
        assert by_name["Bob Team"]["score_delta"] == -1500
        assert by_name["Bob Team"]["rank_delta"] == -1  # dropped 1st -> 2nd

    def test_falls_back_to_oldest_snapshot_when_history_is_young(
        self, anon_client, user_factory, rider_factory, team_factory
    ):
        team = team_factory(
            user=user_factory(), riders=[rider_factory(current=5000)], locked=True
        )
        two_days_ago = datetime.date.today() - datetime.timedelta(days=2)
        yesterday = datetime.date.today() - datetime.timedelta(days=1)
        TeamScoreSnapshot.objects.create(team=team, date=two_days_ago, total_score=4200, rank=1)
        TeamScoreSnapshot.objects.create(team=team, date=yesterday, total_score=4800, rank=1)

        resp = anon_client.get("/api/leaderboard/?year=2026")
        entry = resp.data[0]
        assert entry["score_delta"] == 800  # vs oldest snapshot, not yesterday's
        assert entry["delta_since"] == str(two_days_ago)

    def test_todays_snapshot_is_not_used_as_reference(
        self, anon_client, user_factory, rider_factory, team_factory
    ):
        team = team_factory(
            user=user_factory(), riders=[rider_factory(current=5000)], locked=True
        )
        TeamScoreSnapshot.objects.create(
            team=team, date=datetime.date.today(), total_score=5000, rank=1
        )
        resp = anon_client.get("/api/leaderboard/?year=2026")
        assert resp.data[0]["score_delta"] is None

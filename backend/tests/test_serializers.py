import pytest
from rest_framework.exceptions import ValidationError

from api.models import FantasyTeam
from api.serializers import FantasyTeamSerializer


def make_riders(rider_factory, count, prev=100):
    return [rider_factory(name=f"Rider{i}", prev=prev) for i in range(count)]


@pytest.mark.django_db
class TestFantasyTeamSerializerValidation:
    def test_budget_exact_passes(self, user_factory, rider_factory):
        user = user_factory()
        # 200 riders × 100 pts = 20,000 — but MAX_RIDERS is 20, so use 20 × 1000
        riders = make_riders(rider_factory, 20, prev=1000)
        serializer = FantasyTeamSerializer(
            data={"name": "Team", "rider_ids": [r.id for r in riders]},
            context={"request": _fake_request(user)},
        )
        assert serializer.is_valid(), serializer.errors

    def test_budget_exceeded_raises(self, user_factory, rider_factory):
        user = user_factory()
        # 20 riders × 1001 pts = 20,020 > 20,000
        riders = make_riders(rider_factory, 20, prev=1001)
        serializer = FantasyTeamSerializer(
            data={"name": "Team", "rider_ids": [r.id for r in riders]},
            context={"request": _fake_request(user)},
        )
        assert not serializer.is_valid()
        assert "riders" in serializer.errors

    def test_max_riders_exact_passes(self, user_factory, rider_factory):
        user = user_factory()
        riders = make_riders(rider_factory, 20, prev=100)
        serializer = FantasyTeamSerializer(
            data={"name": "Team", "rider_ids": [r.id for r in riders]},
            context={"request": _fake_request(user)},
        )
        assert serializer.is_valid(), serializer.errors

    def test_max_riders_exceeded_raises(self, user_factory, rider_factory):
        user = user_factory()
        riders = make_riders(rider_factory, 21, prev=10)
        serializer = FantasyTeamSerializer(
            data={"name": "Team", "rider_ids": [r.id for r in riders]},
            context={"request": _fake_request(user)},
        )
        assert not serializer.is_valid()
        assert "riders" in serializer.errors

    def test_zero_cost_rider_counts_toward_roster_limit(self, user_factory, rider_factory):
        user = user_factory()
        # 21 free riders — over the roster cap, under budget
        riders = make_riders(rider_factory, 21, prev=0)
        serializer = FantasyTeamSerializer(
            data={"name": "Team", "rider_ids": [r.id for r in riders]},
            context={"request": _fake_request(user)},
        )
        assert not serializer.is_valid()
        assert "riders" in serializer.errors

    def test_serialized_output_has_cost_score_count(self, user_factory, rider_factory, team_factory):
        user = user_factory()
        riders = make_riders(rider_factory, 2, prev=500)
        team = team_factory(user=user, riders=riders)
        data = FantasyTeamSerializer(team).data
        assert "total_cost" in data
        assert "total_score" in data
        assert "rider_count" in data
        assert data["rider_count"] == 2

    def test_rider_ids_not_in_output(self, user_factory, rider_factory, team_factory):
        user = user_factory()
        team = team_factory(user=user)
        data = FantasyTeamSerializer(team).data
        assert "rider_ids" not in data
        assert "riders" in data


class _fake_request:
    def __init__(self, user):
        self.user = user

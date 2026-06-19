import pytest
from django.db import IntegrityError

from api.models import Rider, FantasyTeam


@pytest.mark.django_db
class TestRiderModel:
    def test_ordering_by_prev_year_desc(self, rider_factory):
        rider_factory(name="Cheap", prev=100)
        rider_factory(name="Expensive", prev=5000)
        names = list(Rider.objects.values_list("name", flat=True))
        assert names[0] == "Expensive"
        assert names[1] == "Cheap"


@pytest.mark.django_db
class TestFantasyTeamProperties:
    def test_total_cost_uses_prev_year_points(self, user_factory, rider_factory, team_factory):
        user = user_factory()
        r1 = rider_factory(name="A", prev=3000, current=500)
        r2 = rider_factory(name="B", prev=2000, current=999)
        team = team_factory(user=user, riders=[r1, r2])
        assert team.total_cost == 5000

    def test_total_score_uses_current_year_points(self, user_factory, rider_factory, team_factory):
        user = user_factory()
        r1 = rider_factory(name="A", prev=3000, current=500)
        r2 = rider_factory(name="B", prev=2000, current=999)
        team = team_factory(user=user, riders=[r1, r2])
        assert team.total_score == 1499

    def test_cost_and_score_use_different_columns(self, user_factory, rider_factory, team_factory):
        """Catches accidental swapping of prev/current column references."""
        user = user_factory()
        rider = rider_factory(prev=1000, current=50)
        team = team_factory(user=user, riders=[rider])
        assert team.total_cost != team.total_score
        assert team.total_cost == 1000
        assert team.total_score == 50

    def test_total_cost_zero_with_no_riders(self, user_factory, team_factory):
        user = user_factory()
        team = team_factory(user=user)
        assert team.total_cost == 0

    def test_total_score_zero_with_no_riders(self, user_factory, team_factory):
        user = user_factory()
        team = team_factory(user=user)
        assert team.total_score == 0

    def test_rider_count(self, user_factory, rider_factory, team_factory):
        user = user_factory()
        r1 = rider_factory(name="A")
        r2 = rider_factory(name="B")
        team = team_factory(user=user, riders=[r1, r2])
        assert team.rider_count == 2

    def test_free_rider_included_in_total_cost(self, user_factory, rider_factory, team_factory):
        """A rider with 0 prev_year_points costs 0 but is still on the roster."""
        user = user_factory()
        free_rider = rider_factory(prev=0, current=100)
        paid_rider = rider_factory(name="Paid", prev=1000, current=0)
        team = team_factory(user=user, riders=[free_rider, paid_rider])
        assert team.total_cost == 1000
        assert team.rider_count == 2

    def test_unique_together_user_year(self, user_factory, team_factory):
        user = user_factory()
        team_factory(user=user, year=2026)
        with pytest.raises(IntegrityError):
            FantasyTeam.objects.create(user=user, name="Second Team", year=2026)

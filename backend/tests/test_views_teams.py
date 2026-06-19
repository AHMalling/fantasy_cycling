import pytest
from unittest.mock import patch
import datetime
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.models import FantasyTeam


def make_auth_client(user):
    token = Token.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client


@pytest.mark.django_db
class TestTeamCreate:
    def test_stamps_current_year(self, auth_client, user_and_token):
        with patch("api.views.datetime") as mock_dt:
            mock_dt.date.today.return_value = datetime.date(2026, 6, 1)
            resp = auth_client.post("/api/teams/", {"name": "My Team", "rider_ids": []}, format="json")
        assert resp.status_code == 201
        assert resp.data["year"] == 2026

    def test_unauthenticated_returns_401(self, anon_client):
        resp = anon_client.post("/api/teams/", {"name": "Team"})
        assert resp.status_code == 401


@pytest.mark.django_db
class TestTeamList:
    def test_only_returns_own_teams(self, user_factory, team_factory):
        alice = user_factory(username="alice")
        bob = user_factory(username="bob")
        team_factory(user=alice, name="Alice Team")
        team_factory(user=bob, name="Bob Team")

        alice_client = make_auth_client(alice)
        resp = alice_client.get("/api/teams/")
        assert resp.status_code == 200
        names = [t["name"] for t in resp.data["results"]]
        assert "Alice Team" in names
        assert "Bob Team" not in names

    def test_cannot_access_other_users_team(self, user_factory, team_factory):
        alice = user_factory(username="alice")
        bob = user_factory(username="bob")
        bob_team = team_factory(user=bob, name="Bob Team")

        alice_client = make_auth_client(alice)
        resp = alice_client.get(f"/api/teams/{bob_team.id}/")
        assert resp.status_code == 404


@pytest.mark.django_db
class TestTeamUpdate:
    def test_update_unlocked_team_succeeds(self, auth_client, user_and_token, rider_factory, team_factory):
        user, _ = user_and_token
        team = team_factory(user=user)
        rider = rider_factory(prev=500)
        resp = auth_client.put(f"/api/teams/{team.id}/", {
            "name": "Updated", "rider_ids": [rider.id]
        }, format="json")
        assert resp.status_code == 200
        assert resp.data["name"] == "Updated"

    def test_update_locked_team_returns_403(self, auth_client, user_and_token, rider_factory, team_factory):
        user, _ = user_and_token
        team = team_factory(user=user, locked=True)
        resp = auth_client.put(f"/api/teams/{team.id}/", {"name": "New Name", "rider_ids": []}, format="json")
        assert resp.status_code == 403

    def test_update_budget_exceeded_returns_400(self, auth_client, user_and_token, rider_factory, team_factory):
        user, _ = user_and_token
        team = team_factory(user=user)
        riders = [rider_factory(name=f"R{i}", prev=1001) for i in range(20)]
        resp = auth_client.put(f"/api/teams/{team.id}/", {
            "name": "Team", "rider_ids": [r.id for r in riders]
        }, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestTeamLock:
    def test_lock_nonempty_team_succeeds(self, auth_client, user_and_token, rider_factory, team_factory):
        user, _ = user_and_token
        rider = rider_factory()
        team = team_factory(user=user, riders=[rider])
        resp = auth_client.post(f"/api/teams/{team.id}/lock/")
        assert resp.status_code == 200
        assert resp.data["is_locked"] is True

    def test_lock_empty_team_returns_400(self, auth_client, user_and_token, team_factory):
        user, _ = user_and_token
        team = team_factory(user=user)
        resp = auth_client.post(f"/api/teams/{team.id}/lock/")
        assert resp.status_code == 400

    def test_lock_over_budget_returns_400(self, auth_client, user_and_token, rider_factory, team_factory):
        user, _ = user_and_token
        riders = [rider_factory(name=f"R{i}", prev=1001) for i in range(20)]
        # Bypass serializer validation by setting riders directly on the team
        team = team_factory(user=user, riders=riders)
        resp = auth_client.post(f"/api/teams/{team.id}/lock/")
        assert resp.status_code == 400
        assert "Budget exceeded" in resp.data["detail"]

    def test_lock_already_locked_returns_400(self, auth_client, user_and_token, rider_factory, team_factory):
        user, _ = user_and_token
        rider = rider_factory()
        team = team_factory(user=user, riders=[rider], locked=True)
        resp = auth_client.post(f"/api/teams/{team.id}/lock/")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestPublicDetail:
    def test_returns_locked_team(self, anon_client, user_factory, rider_factory, team_factory):
        user = user_factory()
        rider = rider_factory()
        team = team_factory(user=user, riders=[rider], locked=True)
        resp = anon_client.get(f"/api/teams/{team.id}/public/")
        assert resp.status_code == 200
        assert resp.data["is_locked"] is True

    def test_returns_404_for_unlocked_team(self, anon_client, user_factory, team_factory):
        user = user_factory()
        team = team_factory(user=user, locked=False)
        resp = anon_client.get(f"/api/teams/{team.id}/public/")
        assert resp.status_code == 404

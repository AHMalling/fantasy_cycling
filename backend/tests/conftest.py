import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from api.models import Rider, FantasyTeam


@pytest.fixture
def rider_factory(db):
    def make(name="Rider", prev=1000, current=500, pcs_url=None, **kwargs):
        url = pcs_url or f"rider/{name.lower().replace(' ', '-')}"
        return Rider.objects.create(
            name=name,
            pcs_url=url,
            prev_year_points=prev,
            current_year_points=current,
            **kwargs,
        )
    return make


@pytest.fixture
def user_factory(db):
    def make(username="alice", password="pass1234"):
        return User.objects.create_user(username=username, password=password)
    return make


@pytest.fixture
def user_and_token(user_factory):
    user = user_factory()
    token = Token.objects.create(user=user)
    return user, token.key


@pytest.fixture
def auth_client(user_and_token):
    _, token = user_and_token
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def team_factory(db):
    def make(user, riders=None, locked=False, year=2026, name="My Team"):
        team = FantasyTeam.objects.create(user=user, name=name, year=year, is_locked=locked)
        if riders:
            team.riders.set(riders)
        return team
    return make

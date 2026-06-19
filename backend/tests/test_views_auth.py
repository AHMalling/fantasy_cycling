import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token


@pytest.mark.django_db
class TestRegister:
    def test_creates_user_and_returns_token(self, anon_client):
        resp = anon_client.post("/api/auth/register/", {
            "username": "bob", "email": "bob@example.com", "password": "securepass"
        }, format="json")
        assert resp.status_code == 201
        assert "token" in resp.data
        assert resp.data["user"]["username"] == "bob"

    def test_short_password_returns_400(self, anon_client):
        resp = anon_client.post("/api/auth/register/", {
            "username": "bob", "password": "short"
        }, format="json")
        assert resp.status_code == 400

    def test_duplicate_username_returns_400(self, anon_client, user_factory):
        user_factory(username="alice")
        resp = anon_client.post("/api/auth/register/", {
            "username": "alice", "password": "pass1234"
        }, format="json")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestLogin:
    def test_valid_credentials_returns_token(self, anon_client, user_factory):
        user_factory(username="alice", password="pass1234")
        resp = anon_client.post("/api/auth/login/", {
            "username": "alice", "password": "pass1234"
        }, format="json")
        assert resp.status_code == 200
        assert "token" in resp.data

    def test_invalid_credentials_returns_401(self, anon_client, user_factory):
        user_factory(username="alice", password="pass1234")
        resp = anon_client.post("/api/auth/login/", {
            "username": "alice", "password": "wrongpass"
        }, format="json")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestLogout:
    def test_deletes_token(self, auth_client, user_and_token):
        _, token_key = user_and_token
        resp = auth_client.post("/api/auth/logout/")
        assert resp.status_code == 204
        assert not Token.objects.filter(key=token_key).exists()

    def test_unauthenticated_returns_401(self, anon_client):
        resp = anon_client.post("/api/auth/logout/")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestMe:
    def test_returns_current_user(self, auth_client, user_and_token):
        user, _ = user_and_token
        resp = auth_client.get("/api/auth/me/")
        assert resp.status_code == 200
        assert resp.data["username"] == user.username

    def test_unauthenticated_returns_401(self, anon_client):
        resp = anon_client.get("/api/auth/me/")
        assert resp.status_code == 401

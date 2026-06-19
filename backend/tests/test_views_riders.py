import pytest
from unittest.mock import patch, MagicMock
from django.core.cache import cache


@pytest.mark.django_db
class TestRiderList:
    def test_returns_paginated_response(self, anon_client, rider_factory):
        rider_factory(name="Pogacar", prev=5000)
        resp = anon_client.get("/api/riders/")
        assert resp.status_code == 200
        assert "results" in resp.data
        assert "count" in resp.data

    def test_filter_by_search(self, anon_client, rider_factory):
        rider_factory(name="Tadej Pogacar", prev=5000)
        rider_factory(name="Jonas Vingegaard", prev=4000)
        resp = anon_client.get("/api/riders/?search=pogacar")
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["name"] == "Tadej Pogacar"

    def test_filter_by_search_case_insensitive(self, anon_client, rider_factory):
        rider_factory(name="Tadej Pogacar")
        resp = anon_client.get("/api/riders/?search=POGACAR")
        assert resp.data["count"] == 1

    def test_filter_by_team(self, anon_client, rider_factory):
        rider_factory(name="A", team="UAE Team Emirates")
        rider_factory(name="B", team="Visma")
        resp = anon_client.get("/api/riders/?team=uae")
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["name"] == "A"

    def test_filter_by_nationality(self, anon_client, rider_factory):
        rider_factory(name="Belgian", nationality="BE")
        rider_factory(name="French", nationality="FR")
        resp = anon_client.get("/api/riders/?nationality=be")
        assert resp.data["count"] == 1
        resp2 = anon_client.get("/api/riders/?nationality=BE")
        assert resp2.data["count"] == 1

    def test_no_auth_required(self, anon_client, rider_factory):
        rider_factory()
        resp = anon_client.get("/api/riders/")
        assert resp.status_code == 200


@pytest.mark.django_db
class TestRiderDetails:
    def setup_method(self):
        cache.clear()

    def test_no_pcs_url_returns_empty(self, anon_client, rider_factory):
        rider = rider_factory(pcs_url="")
        resp = anon_client.get(f"/api/riders/{rider.id}/details/")
        assert resp.status_code == 200
        assert resp.data["recent_results"] == []
        assert resp.data["upcoming_races"] == []

    def test_cache_miss_calls_scrape(self, anon_client, rider_factory):
        rider = rider_factory(pcs_url="rider/test-rider")
        scrape_result = {"recent_results": [], "upcoming_races": [], "photo_url": ""}
        with patch("api.views._scrape_rider_details", return_value=scrape_result) as mock_scrape:
            anon_client.get(f"/api/riders/{rider.id}/details/")
            mock_scrape.assert_called_once_with("rider/test-rider")

    def test_cache_hit_skips_scrape(self, anon_client, rider_factory):
        rider = rider_factory(pcs_url="rider/test-rider")
        cached = {"recent_results": [], "upcoming_races": [], "photo_url": ""}
        cache.set(f"rider_details_v5_{rider.pcs_url}", cached)
        with patch("api.views._scrape_rider_details") as mock_scrape:
            anon_client.get(f"/api/riders/{rider.id}/details/")
            mock_scrape.assert_not_called()

    def test_persists_photo_when_blank(self, anon_client, rider_factory):
        rider = rider_factory(pcs_url="rider/test-rider", photo_url="")
        scrape_result = {
            "recent_results": [], "upcoming_races": [],
            "photo_url": "https://pcs.com/photo.jpg"
        }
        with patch("api.views._scrape_rider_details", return_value=scrape_result):
            anon_client.get(f"/api/riders/{rider.id}/details/")
        rider.refresh_from_db()
        assert rider.photo_url == "https://pcs.com/photo.jpg"

    def test_does_not_overwrite_existing_photo(self, anon_client, rider_factory):
        existing_url = "https://pcs.com/existing.jpg"
        rider = rider_factory(pcs_url="rider/test-rider", photo_url=existing_url)
        scrape_result = {
            "recent_results": [], "upcoming_races": [],
            "photo_url": "https://pcs.com/different.jpg"
        }
        with patch("api.views._scrape_rider_details", return_value=scrape_result):
            anon_client.get(f"/api/riders/{rider.id}/details/")
        rider.refresh_from_db()
        assert rider.photo_url == existing_url

import datetime
import logging
import threading

import cloudscraper
from decouple import config
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.db.models import ExpressionWrapper, F, FloatField
from django.shortcuts import get_object_or_404
from procyclingstats import RiderResults
from selectolax.parser import HTMLParser
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import FantasyTeam, League, RaceResult, Rider, TeamScoreSnapshot
from .serializers import (
    FantasyTeamSerializer,
    LeaderboardSerializer,
    LeagueSerializer,
    RegisterSerializer,
    RiderSerializer,
    TeamScoreSnapshotSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


def _scrape_rider_details(pcs_url: str) -> dict:
    """
    Fetches recent results (with UCI points) and upcoming races for a rider
    from ProCyclingStats. Returns a dict with keys 'recent_results' and
    'upcoming_races'.
    """
    year = datetime.date.today().year
    recent_results = []
    upcoming_races = []

    session = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "desktop": True}
    )

    # --- Recent results: fetch the results page ourselves, pass HTML to library ---
    try:
        results_url = f"https://www.procyclingstats.com/{pcs_url}/results/{year}"
        resp = session.get(results_url, timeout=15)
        resp.raise_for_status()
        rr = RiderResults(f"{pcs_url}/results/{year}", html=resp.text, update_html=False)
        rows = rr.results("date", "rank", "stage_name", "stage_url", "uci_points", "class")
        completed = [r for r in rows if r.get("rank") is not None and (r.get("uci_points") or 0) > 0]
        completed.sort(key=lambda r: r.get("date") or "", reverse=True)
        for r in completed[:3]:
            recent_results.append({
                "date": r.get("date"),
                "rank": r.get("rank"),
                "race_name": r.get("stage_name"),
                "race_url": r.get("stage_url"),
                "uci_points": r.get("uci_points") or 0,
                "category": r.get("class"),
            })
    except Exception as exc:
        logger.debug("RiderResults scrape failed for %s: %s", pcs_url, exc)

    # --- Upcoming races + photo from the rider profile page ---
    photo_url = ""
    try:
        resp = session.get(
            f"https://www.procyclingstats.com/{pcs_url}",
            timeout=15,
        )
        resp.raise_for_status()
        tree = HTMLParser(resp.text)

        # Rider photo — try common PCS selectors
        photo_img = (
            tree.css_first("div.rdrImg img")
            or tree.css_first("img[src*='images/riders']")
        )
        if photo_img:
            src = photo_img.attributes.get("src", "")
            if src:
                if not src.startswith("http"):
                    src = f"https://www.procyclingstats.com/{src.lstrip('/')}"
                photo_url = src

        # Structure: <div class="mt20"><h4>Program</h4><ul class="list ..."><li>…</li></ul></div>
        for h4 in tree.css("h4"):
            if h4.text(strip=True).lower() != "program":
                continue
            program_div = h4.parent
            for li in program_div.css("li"):
                # Date is in the first div (class contains "mr5" or "bold")
                date_div = li.css_first("div.mr5")
                # Race link points to race/ — skip the "more" rider-in-race link
                race_link = li.css_first("a[href^='race/']")
                if not race_link:
                    continue
                date_text = date_div.text(strip=True) if date_div else ""
                race_date = None
                if date_text and "." in date_text:
                    parts = date_text.split(".")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        race_date = f"{year}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                href = race_link.attributes.get("href", "").lstrip("/")
                # Strip /startlist suffix so the URL points to the race overview
                href = href.removesuffix("/startlist")
                upcoming_races.append({
                    "date": race_date,
                    "race_name": race_link.text(strip=True),
                    "race_url": href,
                })
            break  # only one Program section
    except Exception as exc:
        logger.debug("Profile page scrape failed for %s: %s", pcs_url, exc)

    return {"recent_results": recent_results, "upcoming_races": upcoming_races, "photo_url": photo_url}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api_view(["GET"])
def health(request):
    return Response({"status": "ok", "message": "Fantasy Cycling API is running."})


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")
    user = authenticate(username=username, password=password)
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user).data})
    return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


# ---------------------------------------------------------------------------
# Riders
# ---------------------------------------------------------------------------

_VALID_ORDERINGS = {
    "name": "name",
    "-name": "-name",
    "cost": "prev_year_points",
    "-cost": "-prev_year_points",
    "score": "current_year_points",
    "-score": "-current_year_points",
}


class RiderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RiderSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Rider.objects.all()
        search = self.request.query_params.get("search")
        team = self.request.query_params.get("team")
        nationality = self.request.query_params.get("nationality")
        ordering = self.request.query_params.get("ordering", "-cost")
        if search:
            qs = qs.filter(name__icontains=search)
        if team:
            qs = qs.filter(team__icontains=team)
        if nationality:
            qs = qs.filter(nationality__icontains=nationality)
        qs = qs.order_by(_VALID_ORDERINGS.get(ordering, "-prev_year_points"))
        return qs

    @action(detail=False, methods=["get"], url_path="ownership", permission_classes=[AllowAny])
    def ownership(self, request):
        """Returns ownership stats: how many locked teams drafted each rider."""
        from django.db.models import Count, Q
        year = int(request.query_params.get("year", datetime.date.today().year))
        cache_key = f"rider_ownership_{year}"
        data = cache.get(cache_key)
        if data is None:
            locked_teams = FantasyTeam.objects.filter(year=year, is_locked=True)
            total = locked_teams.count()
            if total == 0:
                data = {"total_teams": 0, "ownership": {}}
            else:
                rider_counts = (
                    Rider.objects.annotate(
                        team_count=Count(
                            "fantasyteam",
                            filter=Q(fantasyteam__in=locked_teams),
                        )
                    )
                    .filter(team_count__gt=0)
                    .values("id", "team_count")
                )
                ownership = {str(r["id"]): r["team_count"] for r in rider_counts}
                data = {"total_teams": total, "ownership": ownership}
            cache.set(cache_key, data, timeout=300)  # 5 min
        return Response(data)

    @action(detail=False, methods=["get"], url_path="top-performers", permission_classes=[AllowAny])
    def top_performers(self, request):
        """Returns top 10 riders ranked by current_year_points / prev_year_points ratio."""
        n = min(int(request.query_params.get("n", 10)), 50)
        riders = (
            Rider.objects.filter(prev_year_points__gte=50, current_year_points__gt=0)
            .annotate(
                performance_ratio=ExpressionWrapper(
                    F("current_year_points") * 1.0 / F("prev_year_points"),
                    output_field=FloatField(),
                )
            )
            .order_by("-performance_ratio")[:n]
        )
        return Response(RiderSerializer(riders, many=True).data)

    @action(detail=True, methods=["get"], url_path="details")
    def details(self, request, pk=None):
        rider = self.get_object()
        if not rider.pcs_url:
            return Response({"recent_results": [], "upcoming_races": []})
        cache_key = f"rider_details_v5_{rider.pcs_url}"
        data = cache.get(cache_key)
        if data is None:
            data = _scrape_rider_details(rider.pcs_url)
            cache.set(cache_key, data, timeout=1800)  # 30 min
        # Persist photo URL the first time we scrape it
        if data.get("photo_url") and not rider.photo_url:
            rider.photo_url = data["photo_url"]
            rider.save(update_fields=["photo_url"])
        return Response(data)


# ---------------------------------------------------------------------------
# Fantasy Teams
# ---------------------------------------------------------------------------

class FantasyTeamViewSet(viewsets.ModelViewSet):
    serializer_class = FantasyTeamSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "put", "patch", "delete"]

    def get_queryset(self):
        return (
            FantasyTeam.objects.filter(user=self.request.user)
            .prefetch_related("riders")
        )

    def perform_create(self, serializer):
        year = datetime.date.today().year
        serializer.save(user=self.request.user, year=year)

    def update(self, request, *args, **kwargs):
        team = self.get_object()
        if team.is_locked:
            return Response(
                {"detail": "Team is locked and cannot be modified."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="public")
    def public_detail(self, request, pk=None):
        team = (
            FantasyTeam.objects.filter(pk=pk, is_locked=True)
            .prefetch_related("riders")
            .select_related("user")
            .first()
        )
        if not team:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(FantasyTeamSerializer(team).data)

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        team = self.get_object()
        if team.is_locked:
            return Response({"detail": "Team is already locked."}, status=status.HTTP_400_BAD_REQUEST)
        if team.rider_count == 0:
            return Response({"detail": "Cannot lock an empty team."}, status=status.HTTP_400_BAD_REQUEST)
        if team.total_cost > FantasyTeam.BUDGET_CAP:
            return Response(
                {"detail": f"Budget exceeded: {team.total_cost} points used, cap is {FantasyTeam.BUDGET_CAP}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        team.is_locked = True
        team.save()
        return Response(FantasyTeamSerializer(team).data)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="snapshots")
    def snapshots(self, request, pk=None):
        team = FantasyTeam.objects.filter(pk=pk, is_locked=True).first()
        if not team:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)
        snaps = team.snapshots.order_by("date")
        return Response(TeamScoreSnapshotSerializer(snaps, many=True).data)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="race-breakdown")
    def race_breakdown(self, request, pk=None):
        team = (
            FantasyTeam.objects.filter(pk=pk, is_locked=True)
            .prefetch_related("riders")
            .first()
        )
        if not team:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

        results = (
            RaceResult.objects
            .filter(rider__fantasyteam=team, year=team.year)
            .select_related("rider")
            .order_by("-date", "-uci_points")
        )

        races: dict[tuple, dict] = {}
        for result in results:
            key = (str(result.date), result.race_name, result.race_url)
            if key not in races:
                races[key] = {
                    "date": str(result.date),
                    "race_name": result.race_name,
                    "race_url": result.race_url,
                    "team_points": 0,
                    "riders": [],
                }
            races[key]["team_points"] += result.uci_points
            races[key]["riders"].append({
                "name": result.rider.name,
                "uci_points": result.uci_points,
                "rank": result.rank,
            })

        sorted_races = sorted(races.values(), key=lambda r: r["date"], reverse=True)
        return Response(sorted_races)


# ---------------------------------------------------------------------------
# Leagues
# ---------------------------------------------------------------------------

class LeagueViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = LeagueSerializer

    def get_permissions(self):
        if self.action in ("retrieve", "leaderboard"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return League.objects.filter(members=self.request.user).order_by("-created_at")
        return League.objects.none()

    def get_object(self):
        # retrieve and leaderboard are public — bypass the user-filtered queryset
        if self.action in ("retrieve", "leaderboard"):
            return get_object_or_404(League, pk=self.kwargs["pk"])
        return super().get_object()

    def perform_create(self, serializer):
        year = datetime.date.today().year
        league = serializer.save(created_by=self.request.user, year=year)
        league.members.add(self.request.user)

    @action(detail=False, methods=["post"], url_path="join", permission_classes=[IsAuthenticated])
    def join(self, request):
        invite_code = (request.data.get("invite_code") or "").strip()
        if not invite_code:
            return Response({"detail": "invite_code is required."}, status=status.HTTP_400_BAD_REQUEST)
        league = League.objects.filter(invite_code=invite_code).first()
        if not league:
            return Response({"detail": "Invalid invite code."}, status=status.HTTP_404_NOT_FOUND)
        league.members.add(request.user)
        return Response(LeagueSerializer(league, context={"request": request}).data)

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="leaderboard")
    def leaderboard(self, request, pk=None):
        league = self.get_object()
        teams = (
            FantasyTeam.objects.filter(
                year=league.year,
                is_locked=True,
                user__in=league.members.all(),
            )
            .prefetch_related("riders")
            .select_related("user")
        )
        ranked = sorted(teams, key=lambda t: t.total_score, reverse=True)
        return Response(LeaderboardSerializer(ranked, many=True).data)


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([AllowAny])
def leaderboard(request):
    year = request.query_params.get("year", datetime.date.today().year)
    teams = (
        FantasyTeam.objects.filter(year=year, is_locked=True)
        .prefetch_related("riders")
        .select_related("user")
    )
    ranked = sorted(teams, key=lambda t: t.total_score, reverse=True)
    return Response(LeaderboardSerializer(ranked, many=True).data)


# ---------------------------------------------------------------------------
# Admin triggers (protected by SYNC_SECRET env var)
# ---------------------------------------------------------------------------

_VALID_COMMANDS = {"sync_riders", "sync_results", "sync_photos", "take_snapshot"}
_sync_lock = threading.Lock()


def _check_secret(request) -> bool:
    secret = config("SYNC_SECRET", default="")
    provided = request.query_params.get("secret") or request.data.get("secret", "")
    return bool(secret) and provided == secret


@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def admin_sync(request, command):
    if command not in _VALID_COMMANDS:
        return Response({"detail": "Unknown command."}, status=status.HTTP_404_NOT_FOUND)

    if not _check_secret(request):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    if not _sync_lock.acquire(blocking=False):
        return Response({"detail": "A sync is already running."}, status=status.HTTP_409_CONFLICT)

    def run():
        try:
            call_command(command)
        except Exception as exc:
            logger.exception("admin_sync %s failed: %s", command, exc)
        finally:
            _sync_lock.release()

    threading.Thread(target=run, daemon=True).start()
    return Response({"detail": f"{command} started in background."})


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_push_riders(request):
    """
    Accept a JSON array of rider objects and upsert them into the DB.
    Used to push locally-scraped rider data to production when PCS
    blocks requests from cloud server IPs.

    Body: [{"pcs_url": "rider/tadej-pogacar", "name": "Tadej Pogačar",
            "team": "...", "nationality": "SI",
            "prev_year_points": 1234, "current_year_points": 567}, ...]
    """
    if not _check_secret(request):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    riders = request.data if isinstance(request.data, list) else request.data.get("riders", [])
    if not riders:
        return Response({"detail": "No rider data provided."}, status=status.HTTP_400_BAD_REQUEST)

    now = datetime.datetime.now(datetime.timezone.utc)
    created_count = updated_count = 0

    for r in riders:
        pcs_url = r.get("pcs_url", "").strip()
        if not pcs_url:
            continue
        _, created = Rider.objects.update_or_create(
            pcs_url=pcs_url,
            defaults={
                "name": r.get("name", ""),
                "team": r.get("team", ""),
                "nationality": r.get("nationality", ""),
                "prev_year_points": int(r.get("prev_year_points", 0)),
                "current_year_points": int(r.get("current_year_points", 0)),
                "last_synced": now,
            },
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    return Response({"created": created_count, "updated": updated_count, "total": created_count + updated_count})


@api_view(["POST"])
@permission_classes([AllowAny])
def admin_push_results(request):
    """
    Accept a JSON array of race result objects and upsert them into the DB.
    Used to push locally-scraped results to production when PCS blocks cloud IPs.

    Body: [{"rider_pcs_url": "rider/tadej-pogacar", "date": "2026-05-15",
            "race_name": "Giro d'Italia | Stage 15", "race_url": "race/...",
            "uci_points": 100, "rank": 1, "category": "2.UWT", "year": 2026}, ...]
    """
    if not _check_secret(request):
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    results = request.data if isinstance(request.data, list) else request.data.get("results", [])
    if not results:
        return Response({"detail": "No result data provided."}, status=status.HTTP_400_BAD_REQUEST)

    created_count = updated_count = skipped = 0
    rider_cache: dict[str, Rider] = {}

    for r in results:
        pcs_url = r.get("rider_pcs_url", "").strip()
        if not pcs_url:
            skipped += 1
            continue
        if pcs_url not in rider_cache:
            try:
                rider_cache[pcs_url] = Rider.objects.get(pcs_url=pcs_url)
            except Rider.DoesNotExist:
                skipped += 1
                continue
        rider = rider_cache[pcs_url]

        date_str = r.get("date", "")
        race_name = r.get("race_name", "").strip()
        if not date_str or not race_name:
            skipped += 1
            continue
        try:
            result_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            skipped += 1
            continue

        _, created = RaceResult.objects.update_or_create(
            rider=rider,
            date=result_date,
            race_name=race_name,
            defaults={
                "race_url": r.get("race_url", "").strip(),
                "uci_points": int(r.get("uci_points", 0)),
                "rank": r.get("rank"),
                "category": r.get("category", "").strip(),
                "year": int(r.get("year", datetime.date.today().year)),
            },
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    return Response({
        "created": created_count,
        "updated": updated_count,
        "skipped": skipped,
        "total": created_count + updated_count,
    })

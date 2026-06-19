import secrets

from django.db import models
from django.contrib.auth.models import User


class Rider(models.Model):
    """A real professional cycling rider with UCI points for two seasons."""

    pcs_url = models.CharField(max_length=255, unique=True)  # e.g. "rider/tadej-pogacar"
    name = models.CharField(max_length=255)
    nationality = models.CharField(max_length=10, blank=True)
    team = models.CharField(max_length=255, blank=True)
    # Previous season UCI points — used as the draft budget cost
    prev_year_points = models.IntegerField(default=0)
    # Current season UCI points — determines fantasy score
    current_year_points = models.IntegerField(default=0)
    photo_url = models.URLField(max_length=500, blank=True)
    last_synced = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-prev_year_points"]

    def __str__(self):
        return self.name


class FantasyTeam(models.Model):
    """A user's fantasy team for one season."""

    BUDGET_CAP = 20_000
    MAX_RIDERS = 20

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=255)
    year = models.IntegerField()
    is_locked = models.BooleanField(default=False)
    riders = models.ManyToManyField(Rider, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "year")

    def __str__(self):
        return f"{self.name} ({self.user.username}, {self.year})"

    @property
    def total_cost(self):
        return self.riders.aggregate(total=models.Sum("prev_year_points"))["total"] or 0

    @property
    def total_score(self):
        return self.riders.aggregate(total=models.Sum("current_year_points"))["total"] or 0

    @property
    def rider_count(self):
        return self.riders.count()


class TeamScoreSnapshot(models.Model):
    """Daily score and rank snapshot for a locked fantasy team."""

    team = models.ForeignKey(FantasyTeam, on_delete=models.CASCADE, related_name="snapshots")
    date = models.DateField()
    total_score = models.IntegerField()
    rank = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("team", "date")
        ordering = ["date"]

    def __str__(self):
        return f"{self.team} — {self.date} — {self.total_score} pts"


class League(models.Model):
    """A private mini-league that groups users and their teams."""

    name = models.CharField(max_length=255)
    invite_code = models.CharField(max_length=20, unique=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_leagues")
    members = models.ManyToManyField(User, related_name="leagues", blank=True)
    year = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = secrets.token_urlsafe(10)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.year})"


class RaceResult(models.Model):
    """A single race result (with UCI points) for a rider in a given year."""

    rider = models.ForeignKey(Rider, on_delete=models.CASCADE, related_name="race_results")
    date = models.DateField()
    race_name = models.CharField(max_length=255)
    race_url = models.CharField(max_length=255, blank=True)
    uci_points = models.IntegerField(default=0)
    rank = models.IntegerField(null=True, blank=True)
    category = models.CharField(max_length=50, blank=True)
    year = models.IntegerField()

    class Meta:
        unique_together = ("rider", "date", "race_name")
        ordering = ["-date"]

    def __str__(self):
        return f"{self.rider.name} — {self.race_name} ({self.date}) — {self.uci_points} pts"

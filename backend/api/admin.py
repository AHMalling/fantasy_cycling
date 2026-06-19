from django.contrib import admin
from .models import FantasyTeam, League, RaceResult, Rider, TeamScoreSnapshot


@admin.register(Rider)
class RiderAdmin(admin.ModelAdmin):
    list_display = ("name", "team", "nationality", "prev_year_points", "current_year_points", "last_synced")
    search_fields = ("name", "team", "nationality")
    ordering = ("-prev_year_points",)


@admin.register(FantasyTeam)
class FantasyTeamAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "year", "is_locked", "created_at")
    list_filter = ("year", "is_locked")
    search_fields = ("name", "user__username")
    raw_id_fields = ("riders",)


@admin.register(TeamScoreSnapshot)
class TeamScoreSnapshotAdmin(admin.ModelAdmin):
    list_display = ("team", "date", "total_score", "rank")
    list_filter = ("date",)
    ordering = ("-date",)


@admin.register(League)
class LeagueAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "year", "invite_code", "created_at")
    list_filter = ("year",)
    search_fields = ("name", "invite_code", "created_by__username")
    filter_horizontal = ("members",)


@admin.register(RaceResult)
class RaceResultAdmin(admin.ModelAdmin):
    list_display = ("rider", "race_name", "date", "uci_points", "rank", "category", "year")
    list_filter = ("year", "category")
    search_fields = ("rider__name", "race_name")
    ordering = ("-date",)

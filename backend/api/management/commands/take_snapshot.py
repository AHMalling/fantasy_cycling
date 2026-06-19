"""
Management command to snapshot daily scores and ranks for all locked teams.

Run this once a day (e.g. via cron or a scheduled task) to build the score
history that powers the trend chart on each team's page.

Usage:
    python manage.py take_snapshot              # snapshot for today
    python manage.py take_snapshot --date 2026-04-01  # back-fill a specific date
"""

import datetime

from django.core.management.base import BaseCommand

from api.models import FantasyTeam, TeamScoreSnapshot


class Command(BaseCommand):
    help = "Snapshot current scores and ranks for all locked teams"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="Date to snapshot as YYYY-MM-DD (default: today)",
        )

    def handle(self, *args, **options):
        date_str = options.get("date")
        if date_str:
            try:
                snap_date = datetime.date.fromisoformat(date_str)
            except ValueError:
                self.stderr.write(f"Invalid date: {date_str}. Use YYYY-MM-DD.")
                return
        else:
            snap_date = datetime.date.today()

        year = snap_date.year
        locked_teams = list(
            FantasyTeam.objects.filter(year=year, is_locked=True).prefetch_related("riders")
        )

        if not locked_teams:
            self.stdout.write(f"No locked teams found for {year}.")
            return

        ranked = sorted(locked_teams, key=lambda t: t.total_score, reverse=True)

        created_count = updated_count = 0
        for rank, team in enumerate(ranked, 1):
            _, created = TeamScoreSnapshot.objects.update_or_create(
                team=team,
                date=snap_date,
                defaults={"total_score": team.total_score, "rank": rank},
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Snapshotted {len(ranked)} teams for {snap_date}. "
                f"Created: {created_count}, Updated: {updated_count}."
            )
        )

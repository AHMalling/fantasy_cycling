import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_rider_photo_url"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="League",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("invite_code", models.CharField(blank=True, max_length=20, unique=True)),
                ("year", models.IntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="created_leagues", to=settings.AUTH_USER_MODEL)),
                ("members", models.ManyToManyField(blank=True, related_name="leagues", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="TeamScoreSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("total_score", models.IntegerField()),
                ("rank", models.IntegerField(blank=True, null=True)),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="snapshots", to="api.fantasyteam")),
            ],
            options={
                "ordering": ["date"],
                "unique_together": {("team", "date")},
            },
        ),
        migrations.CreateModel(
            name="RaceResult",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField()),
                ("race_name", models.CharField(max_length=255)),
                ("race_url", models.CharField(blank=True, max_length=255)),
                ("uci_points", models.IntegerField(default=0)),
                ("rank", models.IntegerField(blank=True, null=True)),
                ("category", models.CharField(blank=True, max_length=50)),
                ("year", models.IntegerField()),
                ("rider", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="race_results", to="api.rider")),
            ],
            options={
                "ordering": ["-date"],
                "unique_together": {("rider", "date", "race_name")},
            },
        ),
    ]

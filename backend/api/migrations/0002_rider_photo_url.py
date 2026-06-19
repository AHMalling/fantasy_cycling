from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="rider",
            name="photo_url",
            field=models.URLField(blank=True, max_length=500),
        ),
    ]

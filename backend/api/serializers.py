from rest_framework import serializers
from django.contrib.auth.models import User
from .models import FantasyTeam, League, Rider, TeamScoreSnapshot


class RiderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rider
        fields = ["id", "name", "team", "nationality", "prev_year_points", "current_year_points", "pcs_url", "photo_url"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class FantasyTeamSerializer(serializers.ModelSerializer):
    riders = RiderSerializer(many=True, read_only=True)
    rider_ids = serializers.PrimaryKeyRelatedField(
        queryset=Rider.objects.all(),
        many=True,
        write_only=True,
        source="riders",
        required=False,
    )
    total_cost = serializers.SerializerMethodField()
    total_score = serializers.SerializerMethodField()
    rider_count = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = FantasyTeam
        fields = [
            "id", "name", "year", "is_locked",
            "total_cost", "total_score", "rider_count",
            "riders", "rider_ids", "username", "created_at",
        ]
        read_only_fields = ["year", "is_locked", "created_at"]

    def get_total_cost(self, obj):
        return obj.total_cost

    def get_total_score(self, obj):
        return obj.total_score

    def get_rider_count(self, obj):
        return obj.rider_count

    def validate(self, data):
        riders = data.get("riders", [])
        if len(riders) > FantasyTeam.MAX_RIDERS:
            raise serializers.ValidationError(
                {"riders": f"Maximum {FantasyTeam.MAX_RIDERS} riders allowed."}
            )
        total_cost = sum(r.prev_year_points for r in riders)
        if total_cost > FantasyTeam.BUDGET_CAP:
            raise serializers.ValidationError(
                {"riders": f"Budget exceeded: {total_cost} points used, cap is {FantasyTeam.BUDGET_CAP}."}
            )
        return data


class LeaderboardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")
    total_score = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    rider_count = serializers.SerializerMethodField()

    class Meta:
        model = FantasyTeam
        fields = ["id", "name", "username", "total_score", "total_cost", "rider_count", "year"]

    def get_total_score(self, obj):
        return obj.total_score

    def get_total_cost(self, obj):
        return obj.total_cost

    def get_rider_count(self, obj):
        return obj.rider_count


class TeamScoreSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamScoreSnapshot
        fields = ["date", "total_score", "rank"]


class LeagueSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    member_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()

    class Meta:
        model = League
        fields = ["id", "name", "invite_code", "created_by_username", "member_count", "is_member", "year", "created_at"]
        read_only_fields = ["invite_code", "year", "created_at", "created_by_username"]

    def get_member_count(self, obj):
        return obj.members.count()

    def get_is_member(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.members.filter(pk=request.user.pk).exists()
        return False

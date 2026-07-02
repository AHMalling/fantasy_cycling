from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"riders", views.RiderViewSet, basename="rider")
router.register(r"teams", views.FantasyTeamViewSet, basename="team")
router.register(r"leagues", views.LeagueViewSet, basename="league")

urlpatterns = [
    path("health/", views.health, name="health"),
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    # Auth
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("auth/me/", views.me, name="me"),
    # Admin triggers
    path("admin/sync/<str:command>/", views.admin_sync, name="admin_sync"),
    path("admin/push-riders/", views.admin_push_riders, name="admin_push_riders"),
    path("admin/push-results/", views.admin_push_results, name="admin_push_results"),
    # Resource routers
    path("", include(router.urls)),
]

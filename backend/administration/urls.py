from rest_framework.routers import DefaultRouter
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from .views import (
    DoctorProfileViewSet,
    StaffViewSet,
    SpecializationViewSet,
    DoctorScheduleViewSet,
    AdminDashboardView,
    RoleListView
)
router = DefaultRouter()

router.register("doctors", DoctorProfileViewSet, basename="doctors")
router.register("staff", StaffViewSet, basename="staff")
router.register("specializations", SpecializationViewSet, basename="specializations")
router.register("doctor-schedules", DoctorScheduleViewSet, basename="doctor-schedules")

urlpatterns = router.urls + [
    path("dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("roles/", RoleListView.as_view(), name="role-list"),
]

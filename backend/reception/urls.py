from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    PatientViewSet,
    AppointmentViewSet,
    ConsultationBillViewSet,
    ReceptionDashboardView,
    DoctorAvailabilityView,
    DoctorListView,
    AvailableSlotsView,
)
from .search import PatientSearchView, PatientQuickLookupView

router = DefaultRouter()

router.register("patients", PatientViewSet, basename="patients")
router.register("appointments", AppointmentViewSet, basename="appointments")
router.register("consultation-bills", ConsultationBillViewSet, basename="consultation-bills")

urlpatterns = [
    # Dashboard
    path(
        "dashboard/",
        ReceptionDashboardView.as_view(),
        name="reception-dashboard"
    ),

    # Active doctors list for appointment booking dropdown
    path(
        "doctors/",
        DoctorListView.as_view(),
        name="reception-doctor-list"
    ),

    # Doctor availability for appointment booking
    path(
        "doctor-availability/",
        DoctorAvailabilityView.as_view(),
        name="doctor-availability"
    ),
    
    # Available time slots for a doctor
    path(
        "available-slots/",
        AvailableSlotsView.as_view(),
        name="available-slots"
    ),
    
    # Scalable patient search
    path(
        "patients/search/",
        PatientSearchView.as_view(),
        name="patient-search"
    ),
    
    # Quick patient lookup by ID/code
    path(
        "patients/lookup/<str:identifier>/",
        PatientQuickLookupView.as_view(),
        name="patient-lookup"
    ),
]

urlpatterns += router.urls

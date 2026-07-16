from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import (
    PrescriptionViewSet,
    PrescriptionItemViewSet,
    LabTestRequestViewSet,
    DoctorAppointmentViewSet,
    DoctorLabResultViewSet,
    PatientRecordView,
    PatientHistoryView,
    PatientSearchView,
    ActiveMedicineListView,
    ActiveLabTestListView,
    CreatePrescriptionWithItemsView,
)
from .patient_history import (
    PatientHistoryView as ComprehensivePatientHistoryView,
    PatientPrescriptionHistoryView,
    PatientLabHistoryView,
)

router = DefaultRouter()

router.register("prescriptions", PrescriptionViewSet)
router.register("prescription-items", PrescriptionItemViewSet)
router.register("lab-requests", LabTestRequestViewSet)
router.register("lab-results", DoctorLabResultViewSet, basename="doctor-lab-results")
router.register("dashboard-appointments", DoctorAppointmentViewSet, basename="doctor-appointments")

# Must be listed BEFORE router.urls so Django resolves this before the router's
# prescriptions/<pk>/ pattern (which would otherwise match "create-with-items" as a pk).
urlpatterns = [
    path("prescriptions/create-with-items/", CreatePrescriptionWithItemsView.as_view(), name="create-prescription-with-items"),
] + router.urls + [
    path("patient-records/", PatientRecordView.as_view(), name="patient-records"),
    path("patients/<int:patient_id>/history/", PatientHistoryView.as_view(), name="patient-history"),
    path("patients/<int:patient_id>/full-history/", ComprehensivePatientHistoryView.as_view(), name="patient-full-history"),
    path("patients/<int:patient_id>/prescriptions/", PatientPrescriptionHistoryView.as_view(), name="patient-prescription-history"),
    path("patients/<int:patient_id>/labs/", PatientLabHistoryView.as_view(), name="patient-lab-history"),
    path("medicines/", ActiveMedicineListView.as_view(), name="doctor-medicines"),
    path("lab-tests/", ActiveLabTestListView.as_view(), name="doctor-lab-tests"),
    path("patients/search/", PatientSearchView.as_view(), name="patient-search"),
]

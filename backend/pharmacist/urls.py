from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    MedicineViewSet,
    MedicineDosageViewSet,
    MedicineInventoryViewSet,
    PharmacyBillViewSet,
    PharmacyBillItemViewSet,
    PharmacistDashboardView,
    PendingPrescriptionListView,
    PrescriptionDetailForPharmacist,
    GenerateBillFromPrescription
)
from .pdf_generator import PharmacyBillPDFView

# =========================
# ROUTER
# =========================
router = DefaultRouter()

router.register(r"medicines", MedicineViewSet, basename="medicine")
router.register(r"medicine-dosages", MedicineDosageViewSet, basename="medicine-dosage")
router.register(r"inventory", MedicineInventoryViewSet, basename="inventory")
router.register(r"pharmacy-bills", PharmacyBillViewSet, basename="pharmacy-bill")
router.register(r"pharmacy-bill-items", PharmacyBillItemViewSet, basename="pharmacy-bill-item")


# =========================
# URLPATTERNS
# =========================
urlpatterns = [
    # 🔥 Include all router URLs
    *router.urls,

    # Dashboard
    path("dashboard/", PharmacistDashboardView.as_view(), name="pharmacist-dashboard"),

    # Prescriptions
    path("prescriptions/pending/", PendingPrescriptionListView.as_view(), name="pending-prescriptions"),

    path(
        "prescriptions/<int:prescription_id>/",
        PrescriptionDetailForPharmacist.as_view(),
        name="prescription-detail"
    ),

    # 🔥 GENERATE BILL (IMPORTANT)
    path(
        "prescriptions/<int:prescription_id>/generate-bill/",
        GenerateBillFromPrescription.as_view(),
        name="generate-bill"
    ),

    # PDF receipt — PAID bills only (returns application/pdf for browser viewer)
    path(
        "pharmacy-bills/<int:bill_id>/pdf/",
        PharmacyBillPDFView.as_view(),
        name="pharmacy-bill-pdf"
    ),
]
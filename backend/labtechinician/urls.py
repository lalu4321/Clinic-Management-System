from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    LabTestCatalogViewSet,
    LabTestParameterViewSet,
    LabTestResultViewSet,
    LabReportViewSet,
    LabTestRequestViewSet,
    LabBillItemViewSet,
    LabBillViewSet
)
from .pdf_generator import LabReportPDFView

router = DefaultRouter()

router.register("lab-tests", LabTestCatalogViewSet, basename="lab-tests")
router.register("lab-parameters", LabTestParameterViewSet, basename="lab-parameters")
router.register("lab-results", LabTestResultViewSet, basename="lab-results")
router.register("lab-reports", LabReportViewSet, basename="lab-reports")
router.register("lab-requests", LabTestRequestViewSet, basename="lab-requests")
router.register("lab-bills", LabBillViewSet, basename="lab-bills")
router.register("lab-bill-items", LabBillItemViewSet, basename="lab-bill-items")

urlpatterns = [
    path(
        "lab-requests/<int:request_id>/pdf/",
        LabReportPDFView.as_view(),
        name="lab-report-pdf"
    ),
]

urlpatterns += router.urls

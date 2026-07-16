from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum
from django.db import transaction
from django.utils import timezone

from doctor.models import LabTestRequest, LabRequestStatus

from .models import (
    LabTestCatalog,
    LabTestParameter,
    LabTestResult,
    LabReport,
    LabBill,
    LabBillItem
)

from .serializers import (
    LabTestCatalogSerializer,
    LabTestParameterSerializer,
    LabTestResultSerializer,
    LabReportSerializer,
    LabBillSerializer,
    LabBillItemSerializer
)

from common.permissions import IsDoctor, IsLabTechnician
from doctor.serializers import LabTestRequestSerializer

try:
    from common.email_service import EmailService
    EMAIL_ENABLED = True
except ImportError:
    EMAIL_ENABLED = False


# =========================================================
# LAB TEST CATALOG
# =========================================================

class LabTestCatalogViewSet(ModelViewSet):

    serializer_class = LabTestCatalogSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]
    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]
    search_fields = ["test_name", "lab_test_code"]
    ordering_fields = ["created_at", "test_name"]
    ordering = ["test_name"]

    def get_queryset(self):
        return LabTestCatalog.objects.prefetch_related("parameters").filter(
            is_deleted=False
        )

    def perform_destroy(self, instance):
        instance.delete()

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.parameters.filter(is_deleted=False).exists() is False:
            pass

    @action(detail=True, methods=["get"])
    def validate_parameters(self, request, pk=None):
        """
        Explicit check endpoint: returns error if test has no parameters.
        Called by the frontend after creating parameters.
        """
        instance = self.get_object()
        count = instance.parameters.filter(is_deleted=False).count()
        if count == 0:
            return Response(
                {"valid": False, "message": "This test has no parameters. Add at least one parameter."},
                status=400,
            )
        return Response({"valid": True, "parameter_count": count})

    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):
        instance = self.get_object()
        LabTestCatalog.objects.filter(pk=instance.pk).update(status="ACTIVE")
        return Response({"message": "Test activated successfully."})

    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):
        instance = self.get_object()
        LabTestCatalog.objects.filter(pk=instance.pk).update(status="INACTIVE")
        return Response({"message": "Test deactivated successfully."})


# =========================================================
# LAB TEST PARAMETERS (catalog parameters CRUD)
# =========================================================

class LabTestParameterViewSet(ModelViewSet):
    """
    CRUD for parameters of a specific lab test catalog entry.
    """

    serializer_class = LabTestParameterSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]
    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["lab_test"]

    def get_queryset(self):
        return LabTestParameter.objects.select_related("lab_test").filter(
            is_deleted=False
        )

    def perform_destroy(self, instance):
        instance.delete()


# =========================================================
# LAB TEST RESULT (Lab Technician ONLY)
# =========================================================

class LabTestResultViewSet(ModelViewSet):

    serializer_class = LabTestResultSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]
    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_abnormal", "request"]
    search_fields = [
        "parameter_name",
        "request__appointment__patient__first_name",
        "request__appointment__patient__last_name",
        "request__appointment__patient__patient_code",
    ]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        return LabTestResult.objects.select_related(
            "request",
            "request__appointment__patient",
            "request__appointment",
            "request__lab_test",
            "technician",
        ).filter(
            technician__user=user,
            is_deleted=False
        )

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        ordered = LabTestRequest.objects.filter(
            status=LabRequestStatus.ORDERED,
            is_deleted=False
        ).count()

        completed = LabTestRequest.objects.filter(
            status=LabRequestStatus.COMPLETED,
            is_deleted=False
        ).count()

        total_bills = LabBill.objects.filter(
            is_deleted=False
        ).aggregate(total=Sum("total_amount"))["total"] or 0

        paid_bills = LabBill.objects.filter(
            status=LabBill.Status.PAID,
            is_deleted=False
        ).count()

        return Response({
            "ordered_tests": ordered,
            "completed_tests": completed,
            "pending_tests": ordered,
            "total_bills": float(total_bills),
            "paid_bills": paid_bills,
        })


# =========================================================
# LAB REPORT (Lab Technician)
# =========================================================

class LabReportViewSet(ModelViewSet):

    serializer_class = LabReportSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]
    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "request"]
    search_fields = [
        "request__appointment__patient__first_name",
        "request__appointment__patient__last_name",
        "request__appointment__patient__patient_code",
    ]
    ordering_fields = ["report_date"]
    ordering = ["-report_date"]

    def get_queryset(self):
        user = self.request.user
        return LabReport.objects.select_related(
            "request",
            "request__appointment__patient",
            "request__appointment__doctor__staff__user",
            "request__lab_test",
            "generated_by",
        ).filter(
            generated_by__user=user,
            is_deleted=False
        )

    def perform_destroy(self, instance):
        instance.delete()


# =========================================================
# LAB REQUEST VIEW (Lab Technician READ + PATCH)
# =========================================================

class LabTestRequestViewSet(ModelViewSet):

    serializer_class = LabTestRequestSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]
    http_method_names = ["get", "patch"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]
    search_fields = [
        "appointment__patient__first_name",
        "appointment__patient__last_name",
        "appointment__patient__patient_code",
        "lab_test__test_name",
    ]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        show_cancelled = self.request.query_params.get("show_cancelled", "").lower() == "true"

        base_qs = LabTestRequest.all_objects if show_cancelled else LabTestRequest.objects

        qs = base_qs.select_related(
            "appointment",
            "appointment__patient",
            "appointment__doctor",
            "appointment__doctor__staff",
            "appointment__doctor__staff__user",
            "lab_test",
        )

        if show_cancelled:
            # Return only doctor-deleted (is_deleted=True) requests
            qs = qs.filter(is_deleted=True)
        else:
            qs = qs.filter(is_deleted=False)

            # Optional filter: exclude requests whose appointment already has any report
            exclude_reported = self.request.query_params.get("exclude_reported", None)
            if exclude_reported and exclude_reported.lower() == "true":
                qs = qs.exclude(
                    appointment__lab_test_requests__report__isnull=False
                )

            # Optional filter: only requests whose appointment's bill is PAID
            bill_paid = self.request.query_params.get("bill_paid", None)
            if bill_paid and bill_paid.lower() == "true":
                qs = qs.filter(
                    appointment__lab_bill__status=LabBill.Status.PAID,
                    appointment__lab_bill__is_deleted=False,
                )

        return qs

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        instance   = serializer.save()

        if (
            old_status != LabRequestStatus.COMPLETED
            and instance.status == LabRequestStatus.COMPLETED
            and EMAIL_ENABLED
        ):
            technician_name = (
                self.request.user.get_full_name()
                or self.request.user.username
            )

            # → Patient: lab results available (legacy)
            try:
                EmailService.send_lab_results_ready(instance)
            except Exception as exc:
                import logging
                logging.getLogger("email_service").error(
                    f"Lab results patient email failed: {exc}"
                )

            # → Doctor: lab result completed with abnormal flag (Trigger 3)
            try:
                EmailService.send_lab_result_completed_to_doctor(
                    instance, technician_name
                )
            except Exception as exc:
                import logging
                logging.getLogger("email_service").error(
                    f"Lab result doctor notification failed: {exc}"
                )


# =========================================================
# LAB BILL (Lab Technician)
# =========================================================

class LabBillViewSet(ModelViewSet):

    serializer_class = LabBillSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]
    http_method_names = ["get", "post", "patch"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "patient"]
    search_fields = [
        "lab_bill_code",
        "patient__first_name",
        "patient__last_name",
        "patient__patient_code",
    ]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return LabBill.objects.select_related(
            "patient",
            "appointment",
        ).prefetch_related(
            "items__test_catalog"
        ).filter(is_deleted=False)

    def perform_update(self, serializer):
        """
        Handles PAID transition with strict appointment-scoped billing:

        ENFORCEMENT (NON-NEGOTIABLE):
          1. ALL test requests for the appointment must be COMPLETED before payment.
          2. Auto-populates items ONLY from COMPLETED requests on the same appointment.
          3. Enforces non-zero total before allowing payment.
          4. Records paid_at IST timestamp.
          5. All writes are inside one atomic block.

        Error message matches spec:
          "Cannot generate the bill until all test requests for the appointment are completed."
        """
        from rest_framework.exceptions import ValidationError as DRFValidationError

        new_status = serializer.validated_data.get("status")
        instance = serializer.instance

        if new_status == LabBill.Status.PAID and instance.status != LabBill.Status.PAID:
            with transaction.atomic():
                bill = LabBill.objects.select_for_update().get(pk=instance.pk)

                # ── GUARD: Cancelled bills can never be paid ──────────────────
                if bill.status == LabBill.Status.CANCELLED:
                    raise DRFValidationError(
                        "Cannot generate or pay bill for cancelled lab requests."
                    )

                # ── GUARD: Reject if every request for the appointment is CANCELLED ──
                if bill.appointment:
                    any_active_request = LabTestRequest.objects.filter(
                        appointment=bill.appointment,
                        is_deleted=False,
                    ).exclude(status=LabRequestStatus.CANCELLED).exists()

                    if not any_active_request:
                        raise DRFValidationError(
                            "Cannot generate or pay bill for cancelled lab requests."
                        )

                # ── CRITICAL ENFORCEMENT: All tests must be COMPLETED ──────────
                if bill.appointment:
                    incomplete_tests = LabTestRequest.objects.filter(
                        appointment=bill.appointment,
                        is_deleted=False,
                    ).exclude(
                        status__in=[
                            LabRequestStatus.COMPLETED,
                            LabRequestStatus.CANCELLED,
                        ]
                    )

                    if incomplete_tests.exists():
                        raise DRFValidationError(
                            "Cannot generate the bill until all test requests "
                            "for the appointment are completed."
                        )

                # Auto-generate items if none exist yet.
                # ALWAYS filter by appointment — NEVER by patient alone.
                if not bill.items.filter(is_deleted=False).exists():
                    if bill.appointment:
                        requests_qs = LabTestRequest.objects.filter(
                            appointment=bill.appointment,
                            status=LabRequestStatus.COMPLETED,
                            is_deleted=False,
                        )
                    else:
                        # Legacy bill without appointment FK (pre-migration data)
                        requests_qs = LabTestRequest.objects.filter(
                            appointment__patient=bill.patient,
                            status=LabRequestStatus.COMPLETED,
                            is_deleted=False,
                        )

                    for req in requests_qs:
                        LabBillItem.objects.get_or_create(
                            lab_bill=bill,
                            test_catalog=req.lab_test,
                            defaults={
                                "quantity": 1,
                                "unit_price": req.lab_test.test_charge,
                            },
                        )
                    bill.recalculate_total()

                # Always re-read total from DB after any item changes
                bill.refresh_from_db(fields=["total_amount"])

                # Prevent PAID if no items / zero amount
                if bill.total_amount == 0:
                    raise DRFValidationError(
                        {"total_amount": "Cannot mark bill as paid: total amount is ₹0. "
                         "Ensure all lab tests for this appointment have been completed first."}
                    )

                # Sync stale in-memory fields so the update() write is accurate
                serializer.instance.total_amount = bill.total_amount
                # Record payment timestamp in IST
                serializer.instance.paid_at = timezone.localtime(timezone.now())

                serializer.save()

            # ── Trigger 5: notify patient + lab tech after payment ────────
            if EMAIL_ENABLED:
                try:
                    bill.refresh_from_db()   # get the saved paid_at / total_amount
                    technician_name = (
                        self.request.user.get_full_name()
                        or self.request.user.username
                    )
                    technician_email = self.request.user.email or None
                    EmailService.send_lab_payment_completed_notification(
                        bill, technician_name, technician_email
                    )
                except Exception as exc:
                    import logging
                    logging.getLogger("email_service").error(
                        f"Lab payment notification failed: {exc}"
                    )
        else:
            serializer.save()

    @action(detail=True, methods=["get"], url_path="print")
    def print_bill(self, request, pk=None):
        """
        Return enriched bill data for receipt printing.
        Only PAID bills may be printed — 403 returned for any other status.
        This backend gate prevents bypassing the UI print restriction via
        direct API calls.
        """
        bill = self.get_object()
        if bill.status != LabBill.Status.PAID:
            return Response(
                {
                    "success": False,
                    "message": "Only paid bills can be printed.",
                },
                status=403,
            )
        serializer = self.get_serializer(bill)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def generate_items(self, request, pk=None):
        """
        Manually regenerate bill items for a PENDING bill.

        ENFORCEMENT:
          - Uses appointment scope (never patient alone).
          - Blocks if any test for the appointment is still ORDERED.
        """
        from rest_framework.exceptions import ValidationError as DRFValidationError

        bill = self.get_object()

        with transaction.atomic():
            bill = LabBill.objects.select_for_update().get(pk=bill.pk)

            if bill.status == LabBill.Status.PAID:
                return Response(
                    {"message": "Cannot regenerate items for a paid bill."},
                    status=400
                )

            if bill.status == LabBill.Status.CANCELLED:
                return Response(
                    {"message": "Cannot generate or pay bill for cancelled lab requests."},
                    status=400
                )

            if not bill.appointment:
                return Response(
                    {"message": "Bill has no associated appointment."},
                    status=400
                )

            # Enforce all tests completed before items can be generated
            incomplete_tests = LabTestRequest.objects.filter(
                appointment=bill.appointment,
                is_deleted=False,
            ).exclude(
                status__in=[LabRequestStatus.COMPLETED, LabRequestStatus.CANCELLED]
            )
            if incomplete_tests.exists():
                return Response(
                    {"message": "Cannot generate the bill until all test requests "
                                "for the appointment are completed."},
                    status=400
                )

            # Appointment-scoped: never mix across appointments
            requests_qs = LabTestRequest.objects.select_for_update().filter(
                appointment=bill.appointment,
                status=LabRequestStatus.COMPLETED,
                is_deleted=False
            )

            for req in requests_qs:
                LabBillItem.objects.get_or_create(
                    lab_bill=bill,
                    test_catalog=req.lab_test,
                    defaults={
                        "quantity": 1,
                        "unit_price": req.lab_test.test_charge
                    }
                )

            bill.recalculate_total()

        return Response({"message": "Bill items generated successfully."})


# =========================================================
# LAB BILL ITEM (Read Only)
# =========================================================

class LabBillItemViewSet(ReadOnlyModelViewSet):

    serializer_class = LabBillItemSerializer
    permission_classes = [IsAuthenticated, IsLabTechnician]

    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["lab_bill"]

    def get_queryset(self):
        return LabBillItem.objects.select_related(
            "lab_bill",
            "test_catalog"
        ).filter(is_deleted=False)

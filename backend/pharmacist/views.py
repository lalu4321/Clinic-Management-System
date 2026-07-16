from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView
from rest_framework.decorators import action

from django.utils import timezone
from django.db.models import Sum, F
from datetime import timedelta
from django.shortcuts import get_object_or_404
from django.db import transaction

from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend

from doctor.models import Prescription, PrescriptionStatus
from doctor.serializers import PrescriptionSerializer

from .models import (
    Medicine,
    MedicineDosage,
    MedicineInventory,
    PharmacyBill,
    PharmacyBillItem,
    PharmacyBillStatus,
    InventoryStatus
)

from .serializers import (
    MedicineSerializer,
    MedicineDosageSerializer,
    MedicineInventorySerializer,
    PharmacyBillSerializer,
    PharmacyBillItemSerializer
)

from common.permissions import IsPharmacist

# Email service
try:
    from common.email_service import EmailService
    EMAIL_ENABLED = True
except ImportError:
    EMAIL_ENABLED = False


# =========================
# MEDICINE DOSAGE
# =========================
class MedicineDosageViewSet(ModelViewSet):
    """
    CRUD for per-medicine dosage strengths (pharmacist only).

    List/filter by medicine:
        GET /pharmacy/medicine-dosages/?medicine=<med_id>

    Create:
        POST /pharmacy/medicine-dosages/ { "medicine": 1, "dosage_value": "500mg" }

    Delete (soft):
        DELETE /pharmacy/medicine-dosages/<dosage_id>/
    """

    serializer_class = MedicineDosageSerializer
    permission_classes = [IsAuthenticated, IsPharmacist]
    http_method_names = ["get", "post", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["medicine"]
    search_fields = ["dosage_value", "medicine__med_name"]
    ordering_fields = ["dosage_value"]
    ordering = ["dosage_value"]

    def get_queryset(self):
        return MedicineDosage.objects.select_related("medicine").filter(is_deleted=False)

    def perform_destroy(self, instance):
        instance.delete()


# =========================
# MEDICINE
# =========================
class MedicineViewSet(ModelViewSet):

    queryset = Medicine.objects.prefetch_related("dosages").filter(is_deleted=False)
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated, IsPharmacist]

    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "company_name"]

    search_fields = ["med_name", "medicine_code", "generic_name"]
    ordering_fields = ["created_at"]
    ordering = ["med_name"]

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):
        instance = self.get_object()
        instance.status = "ACTIVE"
        instance.save()
        return Response({"status": "activated"})

    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):
        instance = self.get_object()
        instance.status = "INACTIVE"
        instance.save()
        return Response({"status": "deactivated"})


# =========================
# INVENTORY
# =========================
class MedicineInventoryViewSet(ModelViewSet):

    queryset = MedicineInventory.objects.filter(is_deleted=False).select_related("medicine")
    serializer_class = MedicineInventorySerializer
    permission_classes = [IsAuthenticated, IsPharmacist]

    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["medicine", "status", "expiry_date"]

    search_fields = ["batch_number", "medicine__med_name"]
    ordering_fields = ["expiry_date", "created_at"]
    ordering = ["expiry_date"]

    def perform_destroy(self, instance):
        instance.delete()


# =========================
# BILL
# =========================
class PharmacyBillViewSet(ModelViewSet):

    serializer_class = PharmacyBillSerializer
    permission_classes = [IsAuthenticated, IsPharmacist]

    def get_queryset(self):
        return PharmacyBill.objects.filter(is_deleted=False).select_related(
            "prescription",
            "prescription__appointment",
            "prescription__appointment__patient"
        ).prefetch_related("items")

    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "prescription"]

    search_fields = [
        "pharmacy_bill_code",
        "prescription__prescription_code",
        "prescription__appointment__patient__patient_code"
    ]

    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def perform_update(self, serializer):
        """Record paid_at timestamp when bill is marked PAID."""
        new_status = serializer.validated_data.get("status")
        instance = serializer.instance
        if new_status == PharmacyBillStatus.PAID and instance.status != PharmacyBillStatus.PAID:
            serializer.instance.paid_at = timezone.now()
        serializer.save()

    def perform_destroy(self, instance):

        if instance.status == PharmacyBillStatus.PAID:
            raise ValidationError("Cannot delete a paid bill.")

        if instance.items.filter(is_deleted=False).exists():
            raise ValidationError("Cannot delete bill with active items.")

        instance.delete()

    @action(detail=True, methods=["get"], url_path="print")
    def print_bill(self, request, pk=None):
        """
        Return enriched bill data for receipt printing.
        Only PAID bills may be printed — returns 403 for any other status.
        Backend gate prevents bypassing the UI restriction via direct API calls.
        """
        bill = self.get_object()
        if bill.status != PharmacyBillStatus.PAID:
            return Response(
                {
                    "success": False,
                    "message": "Only paid bills can be printed.",
                },
                status=403,
            )
        serializer = self.get_serializer(bill)
        return Response(serializer.data)


# =========================
# BILL ITEM
# =========================
class PharmacyBillItemViewSet(ModelViewSet):

    queryset = PharmacyBillItem.objects.filter(is_deleted=False).select_related(
        "pharmacy_bill",
        "inventory",
        "inventory__medicine"
    )

    serializer_class = PharmacyBillItemSerializer
    permission_classes = [IsAuthenticated, IsPharmacist]

    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["pharmacy_bill", "inventory"]

    search_fields = [
        "inventory__batch_number",
        "inventory__medicine__med_name"
    ]

    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def perform_destroy(self, instance):

        bill = instance.pharmacy_bill

        if bill.status == PharmacyBillStatus.PAID:
            raise ValidationError("Cannot delete item from a paid bill.")

        if bill.status == PharmacyBillStatus.CANCELLED:
            raise ValidationError("Cannot delete item from a cancelled bill.")

        # ✅ RESTORE INVENTORY
        MedicineInventory.objects.filter(id=instance.inventory.id).update(
            quantity_available=F('quantity_available') + instance.quantity
        )

        instance.delete()


# =========================
# DASHBOARD
# =========================
class PharmacistDashboardView(APIView):

    permission_classes = [IsAuthenticated, IsPharmacist]

    def get(self, request):

        today = timezone.now().date()

        pending_prescriptions = Prescription.objects.filter(
            status=PrescriptionStatus.ACTIVE,
            is_deleted=False
        ).count()

        low_stock = MedicineInventory.objects.filter(
            quantity_available__lt=20,
            is_deleted=False
        ).count()

        expiring_soon = MedicineInventory.objects.filter(
            expiry_date__lte=today + timedelta(days=30),
            is_deleted=False
        ).count()

        todays_sales = PharmacyBill.objects.filter(
            created_at__date=today,
            status=PharmacyBillStatus.PAID,
            is_deleted=False
        ).aggregate(total=Sum("total_amount"))["total"] or 0

        return Response({
            "pending_prescriptions": pending_prescriptions,
            "low_stock": low_stock,
            "expiring_soon": expiring_soon,
            "todays_sales": todays_sales
        })


# =========================
# PENDING PRESCRIPTIONS
# =========================
class PendingPrescriptionListView(ListAPIView):

    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated, IsPharmacist]

    def get_queryset(self):
        return Prescription.objects.select_related(
            "appointment",
            "appointment__patient",
            "appointment__doctor",
            "appointment__doctor__staff",
            "appointment__doctor__staff__user",
        ).filter(
            status=PrescriptionStatus.ACTIVE,
            is_deleted=False
        )


# =========================
# PRESCRIPTION DETAIL
# =========================
class PrescriptionDetailForPharmacist(APIView):

    permission_classes = [IsAuthenticated, IsPharmacist]

    def get(self, request, prescription_id):

        prescription = get_object_or_404(
            Prescription.objects.select_related(
                "appointment",
                "appointment__patient",
                "appointment__doctor",
                "appointment__doctor__staff",
                "appointment__doctor__staff__user",
            ).filter(is_deleted=False),
            pk=prescription_id
        )

        items = prescription.items.filter(
            is_deleted=False
        ).select_related("medicine")

        item_list = []

        for item in items:

            inventory = MedicineInventory.get_fifo_batch(item.medicine)

            available_qty = MedicineInventory.objects.filter(
                medicine=item.medicine,
                status=InventoryStatus.AVAILABLE,
                expiry_date__gte=timezone.now().date(),
                is_deleted=False
            ).aggregate(total=Sum("quantity_available"))["total"] or 0

            item_list.append({
                "medicine_name": item.medicine.med_name,
                "dosage": item.dosage,
                "quantity": item.quantity,
                "available_quantity": available_qty,
                "batch_number": inventory.batch_number if inventory else None,
            })

        # Build patient_name
        patient = prescription.appointment.patient if prescription.appointment else None
        patient_name = (
            f"{patient.first_name} {patient.last_name}".strip() if patient else ""
        )

        # Build doctor_name
        try:
            u = prescription.appointment.doctor.staff.user
            doctor_name = f"{u.first_name} {u.last_name}".strip()
        except AttributeError:
            doctor_name = ""

        return Response({
            "prescription_id": prescription.prescription_id,
            "prescription_code": prescription.prescription_code,
            "patient_name": patient_name,
            "doctor_name": doctor_name,
            "created_at": prescription.created_at,
            "status": prescription.status,
            "items": item_list,
        })


# =========================
# GENERATE BILL (FIXED)
# =========================
class GenerateBillFromPrescription(APIView):

    permission_classes = [IsAuthenticated, IsPharmacist]

    def post(self, request, prescription_id):

        with transaction.atomic():

            prescription = get_object_or_404(
                Prescription.objects.select_for_update().filter(is_deleted=False),
                pk=prescription_id
            )

            if not prescription.items.filter(is_deleted=False).exists():
                raise ValidationError("Prescription has no items.")

            if prescription.status != PrescriptionStatus.ACTIVE:
                raise ValidationError("Only ACTIVE prescriptions can be billed.")

            # Handle bill pre-created by signal: reuse it if empty, block if already dispensed
            existing_bill = PharmacyBill.objects.select_for_update().filter(
                prescription=prescription,
                is_deleted=False
            ).first()

            if existing_bill:
                if existing_bill.items.filter(is_deleted=False).exists():
                    raise ValidationError("Prescription has already been dispensed.")
                bill = existing_bill
            else:
                bill = PharmacyBill.objects.create(
                    prescription=prescription,
                    total_amount=0
                )

            for item in prescription.items.filter(is_deleted=False):

                remaining_qty = item.quantity

                batches = MedicineInventory.objects.select_for_update().filter(
                    medicine=item.medicine,
                    status=InventoryStatus.AVAILABLE,
                    expiry_date__gte=timezone.now().date(),
                    quantity_available__gt=0,
                    is_deleted=False
                ).order_by("expiry_date", "purchased_date")

                if not batches.exists():
                    raise ValidationError(
                        f"No inventory available for {item.medicine.med_name}"
                    )

                for batch in batches:

                    if remaining_qty <= 0:
                        break

                    available = batch.quantity_available

                    if available <= 0:
                        continue

                    use_qty = min(available, remaining_qty)

                    PharmacyBillItem.objects.create(
                        pharmacy_bill=bill,
                        inventory=batch,
                        quantity=use_qty,
                        unit_price=batch.unit_price,
                        total_price=use_qty * batch.unit_price
                    )
                    # NOTE: PharmacyBillItem.save() already deducts inventory and
                    # calls recalculate_total() — do NOT deduct manually here.

                    remaining_qty -= use_qty

                if remaining_qty > 0:
                    raise ValidationError(
                        f"Insufficient stock for {item.medicine.med_name}"
                    )

            bill.recalculate_total()
            bill.refresh_from_db()

            # Mark prescription as COMPLETED after successful dispensing
            Prescription.objects.filter(pk=prescription.pk).update(
                status=PrescriptionStatus.COMPLETED
            )

            # Also mark the linked appointment as COMPLETED (mirrors doctor complete action)
            from reception.models import ConsultationBill, BillStatus, AppointmentStatus
            from reception.models import Appointment as ReceptionAppointment
            appointment = prescription.appointment
            if appointment and appointment.status == "SCHEDULED":
                paid_bill = ConsultationBill.objects.filter(
                    appointment=appointment,
                    status=BillStatus.PAID,
                    is_deleted=False
                ).exists()
                if paid_bill:
                    ReceptionAppointment.objects.filter(pk=appointment.pk).update(
                        status=AppointmentStatus.COMPLETED,
                        completed_at=timezone.now(),
                        version=appointment.version + 1,
                    )

        # ── Trigger 7: notify prescribing doctor that medicines were dispensed ──
        if EMAIL_ENABLED:
            try:
                bill.refresh_from_db()   # ensure items relation is current
                pharmacist_name = (
                    request.user.get_full_name() or request.user.username
                )
                EmailService.send_medicine_dispensed_to_doctor(bill, pharmacist_name)
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(
                    f"Medicine dispensed doctor notification failed: {exc}"
                )

        return Response({
            "bill_id": bill.pharmacy_bill_id,
            "bill_code": bill.pharmacy_bill_code,
            "total_amount": str(bill.total_amount),
            "message": "Prescription dispensed and completed successfully.",
        })
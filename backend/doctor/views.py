from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from django.db import transaction
# views.py

from rest_framework import status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import Http404
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from reception.models import Appointment

from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError, NotFound
from django_filters.rest_framework import DjangoFilterBackend
from django.http import Http404
from django.db import transaction

from .models import LabTestRequest, LabRequestStatus
from .serializers import LabTestRequestSerializer
from .permission import IsDoctorOrLabTechnician, IsDoctor
from pharmacist.models import Medicine, MedicineStatus
from labtechinician.models import LabTestCatalog

from common.permissions import IsDoctor
from .permission import IsDoctorOrLabTechnician,IsDoctor
from labtechinician.models import LabTestResult
from .models import Prescription, PrescriptionItem, LabTestRequest,PrescriptionStatus,LabRequestStatus

from .serializers import (
    DoctorAppointmentSerializer,
    PrescriptionSerializer,
    PrescriptionItemSerializer,
    LabTestRequestSerializer,PatientRecordSerializer
)

from labtechinician.models import LabTestResult
from labtechinician.serializers import LabTestResultSerializer

from common.permissions import IsDoctor,IsLabTechnician

# Import email service
try:
    from common.email_service import EmailService
    EMAIL_ENABLED = True
except ImportError:
    EMAIL_ENABLED = False


# =========================================================
# PRESCRIPTION VIEWSET
# =========================================================

class PrescriptionViewSet(ModelViewSet):
    queryset = Prescription.objects.all()
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated, IsDoctor]

    http_method_names = ["get", "post","put","patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["status", "appointment"]

    search_fields = [
        "prescription_code",
        "appointment__patient__patient_code"
    ]

    ordering_fields = ["created_at"]
    ordering = ["-created_at"]


    def get_queryset(self):
        user = self.request.user
        return Prescription.objects.select_related(
            "appointment",
            "appointment__patient",
            "appointment__doctor",
        ).prefetch_related(
            "items"
        ).filter(
            is_deleted=False,
            appointment__doctor__staff__user=user
        )


    def perform_destroy(self, instance):

    # 🔒 Prevent deleting completed prescriptions
        if instance.status == PrescriptionStatus.COMPLETED:
            raise ValidationError(
                "Cannot delete a completed prescription."
            )

        instance.is_deleted = True
        instance.save()


    # ------------------------------
    # ACTIVATE PRESCRIPTION
    # ------------------------------
    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):

        prescription = self.get_object()

        if prescription.status != PrescriptionStatus.DRAFT:
            return Response(
                {"error": "Only draft prescriptions can be activated"},
                status=400
            )

        if not prescription.items.filter(is_deleted=False).exists():
            return Response(
                {"error": "Prescription must contain at least one medicine before it can be activated."},
                status=400
            )

        with transaction.atomic():
            prescription = Prescription.objects.select_for_update().get(pk=prescription.pk)
            prescription.status = PrescriptionStatus.ACTIVE
            prescription.save()

        if EMAIL_ENABLED:
            # → Patient: prescription ready (legacy)
            try:
                EmailService.send_prescription_ready(prescription)
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(f"Prescription patient email failed: {exc}")

            # → Pharmacists: new prescription to dispense (Trigger 6)
            try:
                EmailService.send_prescription_to_pharmacist(prescription)
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(f"Pharmacist prescription email failed: {exc}")

        return Response({"message": "Prescription activated"})


    # ------------------------------
    # COMPLETE PRESCRIPTION
    # ------------------------------
    @action(detail=True, methods=["patch"])
    def complete(self, request, pk=None):

        prescription = self.get_object()

        if prescription.status != PrescriptionStatus.ACTIVE:
            return Response(
                {"error": "Only active prescriptions can be completed"},
                status=400
            )

        with transaction.atomic():
            prescription = Prescription.objects.select_for_update().get(pk=prescription.pk)
            prescription.status = PrescriptionStatus.COMPLETED
            prescription.save()

            # ── Mark the linked appointment as COMPLETED ──────────────────
            appointment = prescription.appointment
            if appointment and appointment.status == "SCHEDULED":
                # Verify the bill is PAID before completing the appointment
                from reception.models import ConsultationBill, BillStatus, AppointmentStatus
                paid_bill = ConsultationBill.objects.filter(
                    appointment=appointment,
                    status=BillStatus.PAID,
                    is_deleted=False
                ).exists()

                if paid_bill:
                    from django.utils import timezone as tz
                    appointment.status = AppointmentStatus.COMPLETED
                    appointment.completed_at = tz.now()
                    appointment.version += 1
                    Appointment.objects.filter(pk=appointment.pk).update(
                        status=AppointmentStatus.COMPLETED,
                        completed_at=appointment.completed_at,
                        version=appointment.version,
                    )

        return Response({"message": "Prescription completed"})


    # ------------------------------
    # CANCEL PRESCRIPTION
    # ------------------------------
    @action(detail=True, methods=["patch"])
    def cancel(self, request, pk=None):

        prescription = self.get_object()

        if prescription.status not in [
            PrescriptionStatus.DRAFT,
            PrescriptionStatus.ACTIVE
        ]:
            return Response(
                {"error": "Only draft or active prescriptions can be cancelled"},
                status=400
            )

        with transaction.atomic():
            prescription = Prescription.objects.select_for_update().get(pk=prescription.pk)
            prescription.status = PrescriptionStatus.CANCELLED
            prescription.save()

        
        return Response({"message": "Prescription cancelled"})


# =========================================================
# PRESCRIPTION ITEM VIEWSET
# =========================================================

class PrescriptionItemViewSet(ModelViewSet):
    queryset = PrescriptionItem.objects.all()
    serializer_class = PrescriptionItemSerializer
    permission_classes = [IsAuthenticated, IsDoctor]
    http_method_names = ["get", "post", "patch","put", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["prescription", "medicine"]
    search_fields = ["medicine__med_name"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        user = self.request.user
        return PrescriptionItem.objects.select_related(
            "prescription",
            "prescription__appointment",
            "medicine"
        ).filter(
            is_deleted=False,
            prescription__appointment__doctor__staff__user=user
        )

    def perform_create(self, serializer):
        prescription = serializer.validated_data.get("prescription")
        medicine = serializer.validated_data.get("medicine")
        quantity = serializer.validated_data.get("quantity", 0)

        # Duplicate medicine check
        if PrescriptionItem.objects.filter(
            prescription=prescription,
            medicine=medicine,
            is_deleted=False
        ).exists():
            raise ValidationError({"medicine": "This medicine is already prescribed."})

        # Stock availability check
        from pharmacist.models import MedicineInventory, InventoryStatus
        from django.db.models import Sum
        available_qty = MedicineInventory.objects.filter(
            medicine=medicine,
            status=InventoryStatus.AVAILABLE,
            expiry_date__gte=timezone.now().date(),
            is_deleted=False
        ).aggregate(total=Sum("quantity_available"))["total"] or 0

        if available_qty < quantity:
            raise ValidationError({
                "medicine": (
                    f"Insufficient stock for {medicine.med_name}. "
                    f"Available: {available_qty}, Required: {quantity}."
                )
            })

        serializer.save()

    def perform_destroy(self, instance):
        if instance.prescription.status == PrescriptionStatus.COMPLETED:
            raise ValidationError("Cannot delete a completed prescription.")
        # Soft delete
        instance.is_deleted = True
        instance.save()
# =========================================================
# LAB TEST REQUEST VIEWSET
# =========================================================

# views.py





class LabTestRequestViewSet(ModelViewSet):
    queryset = LabTestRequest.objects.all()
    serializer_class = LabTestRequestSerializer
    
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        if instance.is_deleted:
            return Response(
                {"success": False, "message": "Lab request already deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appointment = instance.appointment

        # Soft-delete uses QuerySet.update() internally — post_save never fires.
        # We must cancel the LabBill explicitly here instead of relying on signals.
        instance.delete()

        # After deletion: clean up any existing LabBillItem for this test on the
        # appointment's PENDING bill (handles the case where lab tech already marked
        # this test COMPLETED and a bill item was auto-created before the doctor deleted it).
        # Also cancel the bill if no active requests remain for the appointment.
        with transaction.atomic():
            from labtechinician.models import LabBill, LabBillItem

            pending_bill = LabBill.objects.select_for_update().filter(
                appointment=appointment,
                status=LabBill.Status.PENDING,
                is_deleted=False,
            ).first()

            if pending_bill:
                # Remove the bill item for the deleted test (if it exists) and recalculate
                removed = LabBillItem.objects.filter(
                    lab_bill=pending_bill,
                    test_catalog=instance.lab_test,
                    is_deleted=False,
                ).update(is_deleted=True, updated_at=timezone.now())
                if removed:
                    pending_bill.recalculate_total()

            # If no active (non-deleted, non-cancelled) requests remain, cancel the bill
            any_active = LabTestRequest.objects.filter(
                appointment=appointment,
                is_deleted=False,
            ).exclude(status=LabRequestStatus.CANCELLED).exists()

            if not any_active and pending_bill:
                LabBill.objects.filter(pk=pending_bill.pk).update(
                    status=LabBill.Status.CANCELLED,
                    updated_at=timezone.now(),
                )

        return Response(
            {"success": True, "message": "Lab request deleted successfully."},
            status=status.HTTP_200_OK
        )
    lookup_field = "lab_test_request_id"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["appointment", "status"]
    search_fields = ["lab_test__test_name"]

    def get_permissions(self):
        # Only doctors can delete
        if self.action in ["destroy"]:
            self.permission_classes = [IsAuthenticated, IsDoctor]
        else:
            self.permission_classes = [IsAuthenticated, IsDoctorOrLabTechnician]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        show_cancelled = self.request.query_params.get("show_cancelled", "").lower() == "true"

        base_qs = LabTestRequest.all_objects if show_cancelled else LabTestRequest.objects

        if show_cancelled:
            qs = base_qs.filter(is_deleted=True)
        else:
            qs = base_qs.filter(is_deleted=False)

        # Doctors see only their own appointments
        if user.groups.filter(name__iexact="Doctor").exists():
            qs = qs.filter(appointment__doctor__staff__user=user)
        return qs.select_related(
            "appointment",
            "appointment__patient",
            "appointment__doctor",
            "appointment__doctor__staff",
            "appointment__doctor__staff__user",
            "lab_test",
        )

   
# DOCTOR APPOINTMENT VIEWSET
# =========================================================
 # make sure you have this custom permission


class DoctorAppointmentViewSet(ReadOnlyModelViewSet):
    serializer_class = DoctorAppointmentSerializer
    permission_classes = [IsAuthenticated, IsDoctor]
    http_method_names = ["get"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]
    search_fields = [
        "appointment_code",
        "patient__patient_code",
        "patient__first_name",
        "patient__last_name"
    ]
    ordering_fields = ["appointment_time"]
    # Default ordering must put missed (is_missed=True) LAST.
    # OrderingFilter uses this attribute as the default when no ?ordering= param
    # is given — it must match what get_queryset() annotates to avoid overriding
    # the is_missed sort with a plain appointment_time sort.
    ordering = ["is_missed", "appointment_time"]


    def get_queryset(self):
        from django.db.models import Case, When, Value, BooleanField
        from datetime import datetime, timedelta

        user = self.request.user

        # Get current IST datetime
        now_ist = timezone.localtime(timezone.now())
        today_date = now_ist.date()
        current_time = now_ist.time()

        # 10-minute grace period: an appointment is only "missed" when the doctor
        # is 10+ minutes late — not instantly.  Compute the cutoff time by
        # subtracting 10 minutes from the current IST time.
        _now_full    = datetime.combine(today_date, current_time)
        _cutoff_full = _now_full - timedelta(minutes=10)

        # Guard: if we're in the first 10 minutes of the day the cutoff would
        # roll back to yesterday — in that case nothing can be missed yet.
        if _cutoff_full.date() < today_date:
            # Fewer than 10 minutes since midnight: all appointments still active
            missed_annotation = Value(False, output_field=BooleanField())
        else:
            grace_cutoff = _cutoff_full.time()
            missed_annotation = Case(
                When(appointment_time__lt=grace_cutoff, then=Value(True)),
                default=Value(False),
                output_field=BooleanField()
            )

        # Return ALL SCHEDULED appointments for today.
        # Appointments whose time has passed the grace window (is_missed=True)
        # are sorted to the END of the queue — they stay visible so the doctor
        # can still attend to them rather than losing them from the list.
        return Appointment.objects.select_related(
            "patient",
            "doctor"
        ).prefetch_related(
            "prescription"
        ).filter(
            doctor__staff__user=user,
            appointment_date=today_date,
            status="SCHEDULED",
            is_deleted=False,
            consultation_bill__status="PAID"
        ).annotate(
            is_missed=missed_annotation
        ).order_by("is_missed", "appointment_time")
# =========================================================
# DOCTOR LAB RESULT VIEWSET
# =========================================================

class DoctorLabResultViewSet(ReadOnlyModelViewSet):
    queryset = LabTestResult.objects.all()

    serializer_class = LabTestResultSerializer

    permission_classes = [IsAuthenticated, IsDoctor]

    filter_backends = [DjangoFilterBackend]

    filterset_fields = {
        "request__appointment": ["exact"]
    }

    def get_queryset(self):

        user = self.request.user

        return LabTestResult.objects.select_related(
            "request",
            "request__appointment",
            "request__appointment__patient",
            "request__lab_test"
        ).filter(
            request__appointment__doctor__staff__user=user,
            is_deleted=False
        )

# =========================================================
# ACTIVE MEDICINE LIST (for prescription form)
# =========================================================
class ActiveMedicineListView(APIView):

    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        from pharmacist.models import MedicineInventory, InventoryStatus
        from django.db.models import Sum, OuterRef, Subquery

        # Annotate each medicine with total non-expired available stock
        available_subquery = MedicineInventory.objects.filter(
            medicine=OuterRef("pk"),
            status=InventoryStatus.AVAILABLE,
            expiry_date__gte=timezone.now().date(),
            is_deleted=False,
        ).values("medicine").annotate(
            total=Sum("quantity_available")
        ).values("total")

        medicines = (
            Medicine.objects.filter(status=MedicineStatus.ACTIVE, is_deleted=False)
            .prefetch_related("dosages")
            .annotate(available_quantity=Subquery(available_subquery))
        )

        result = [
            {
                "med_id":            m.med_id,
                "med_name":          m.med_name,
                "generic_name":      m.generic_name,
                "medicine_code":     m.medicine_code,
                "available_quantity": m.available_quantity or 0,
                # Per-medicine dosage list — empty list if none configured yet
                "dosage_options": [
                    {"dosage_id": d.dosage_id, "dosage_value": d.dosage_value}
                    for d in m.dosages.filter(is_deleted=False).order_by("dosage_value")
                ],
            }
            for m in medicines
        ]
        return Response(result)


# =========================================================
# ACTIVE LAB TEST LIST (for prescription form)
# =========================================================
class ActiveLabTestListView(APIView):

    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        tests = LabTestCatalog.objects.filter(
            status="ACTIVE",
            is_deleted=False
        ).values("lab_test_id", "lab_test_code", "test_name", "test_charge")
        return Response(list(tests))


class PatientHistoryView(APIView):

    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request, patient_id):

        from reception.models import Patient

        user = request.user

        # Verify patient exists before querying appointments
        try:
            Patient.objects.get(patient_id=patient_id, is_deleted=False)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found"}, status=404)

        # ✅ Optimized Query (avoids N+1 problem)
        appointments = Appointment.objects.select_related(
            "patient"
        ).prefetch_related(
            "prescription__items__medicine",
            "lab_test_requests__lab_test",
            "lab_test_requests__results"
        ).filter(
            patient_id=patient_id,
            doctor__staff__user=user,
            is_deleted=False
        ).order_by("-appointment_date")

        history = []

        for appointment in appointments:

            prescription = getattr(appointment, "prescription", None)

            # -------------------------
            # MEDICINES
            # -------------------------
            medicines = []
            if prescription:
                items = prescription.items.all()

                medicines = [
                    {
                        "medicine": item.medicine.med_name,
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                        "quantity": item.quantity
                    }
                    for item in items
                ]

            # -------------------------
            # ✅ LAB RESULTS
            # -------------------------
            lab_results = []

            lab_requests = appointment.lab_test_requests.all()

            for req in lab_requests:
                for result in req.results.all():
                    lab_results.append({
                        "test": req.lab_test.test_name,
                        "parameter": result.parameter_name,
                        "result": result.result_value,
                        "unit": result.unit or "",
                        "is_abnormal": result.is_abnormal,
                    })

            # -------------------------
            # FINAL RESPONSE ENTRY
            # -------------------------
            history.append({
                "appointment_code": appointment.appointment_code,
                "date": appointment.appointment_date,
                "status": appointment.status,
                "symptoms": prescription.symptoms if prescription else "",
                "diagnosis": prescription.diagnosis if prescription else "",
                "medicines": medicines,
                "lab_results": lab_results
            })

        return Response({
            "patient_id": patient_id,
            "total_visits": len(history),
            "history": history
        })


class PatientSearchView(APIView):
    """
    GET /doctor/patients/search/?q=<name_or_code>
    Returns patients this doctor has seen (or all patients if admin).
    Used by PatientHistory page to search by name instead of numeric ID.
    """
    permission_classes = [IsAuthenticated, IsDoctor]

    def get(self, request):
        from reception.models import Patient
        q = (request.query_params.get("q") or "").strip()
        if not q:
            return Response({"patients": []})

        user = request.user

        # Patients this doctor has ever seen
        patient_ids = Appointment.objects.filter(
            doctor__staff__user=user,
            is_deleted=False
        ).values_list("patient_id", flat=True).distinct()

        qs = Patient.objects.filter(
            patient_id__in=patient_ids,
            is_deleted=False
        )

        # Filter by name or patient_code
        from django.db.models import Q
        qs = qs.filter(
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(patient_code__icontains=q)
        )[:10]

        results = [
            {
                "patient_id": p.patient_id,
                "patient_code": p.patient_code,
                "full_name": f"{p.first_name} {p.last_name}".strip(),
                "phone": p.phone,
            }
            for p in qs
        ]
        return Response({"patients": results})


class PatientRecordView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]

    @transaction.atomic
    def post(self, request):
        serializer = PatientRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        appointment_id = data.get("appointment_id")

        # -------------------------
        # Validate appointment
        # -------------------------
        try:
            appointment = Appointment.objects.get(
                id=appointment_id,
                doctor__staff__user=user,
                is_deleted=False
            )
        except Appointment.DoesNotExist:
            return Response({"error": "Invalid appointment"}, status=400)

        # -------------------------
        # Create prescription
        # -------------------------
        prescription = Prescription.objects.create(
            appointment=appointment,
            diagnosis=data.get("diagnosis", ""),
            symptoms=data.get("symptoms", ""),
            status=PrescriptionStatus.DRAFT
        )

        # -------------------------
        # Add medicines safely
        # -------------------------
        for med in data.get("medicines", []):
            medicine_id = med.get("medicine")
            if not medicine_id:
                raise ValidationError({"medicine": "Medicine ID is required."})

            PrescriptionItem.objects.create(
                prescription=prescription,
                medicine_id=medicine_id,
                dosage=med.get("dosage", ""),
                frequency=med.get("frequency", ""),
                quantity=med.get("quantity", 0)
            )

        # -------------------------
        # Add lab test requests safely
        # -------------------------
        for test_id in data.get("lab_tests", []):
            if not test_id:
                raise ValidationError({"lab_test": "LabTest ID is required."})

            LabTestRequest.objects.create(
                appointment=appointment,
                lab_test_id=test_id,
                notes=data.get("notes", "")
            )

        return Response({
            "message": "Patient record created successfully",
            "prescription_id": prescription.prescription_id
        }, status=201)


# =========================================================
# ATOMIC PRESCRIPTION + ITEMS CREATION
# =========================================================

class CreatePrescriptionWithItemsView(APIView):
    """
    Creates a prescription with all its medicine items atomically.

    Either the prescription AND every medicine item are saved together
    (and the prescription is immediately activated), or nothing is written
    to the database at all.  This prevents orphaned DRAFT prescriptions
    that have no medicines attached.

    Request body:
        {
            "appointment": <id>,
            "symptoms":    "<text>",
            "diagnosis":   "<text>",
            "medicines": [
                {"medicine": <id>, "dosage": "500mg",
                 "frequency": "1-0-1", "quantity": 2},
                ...
            ]
        }

    On medicine validation failure the response includes per-row errors:
        {
            "success": false,
            "message": "<first error message>",
            "errors": {
                "medicines": {
                    "0": {"quantity": ["Insufficient stock..."]}
                }
            }
        }
    """

    permission_classes = [IsAuthenticated, IsDoctor]

    def post(self, request):
        medicines_data = request.data.get("medicines") or []

        # ── Guard: consultation cannot start before scheduled appointment time ──
        appointment_id = request.data.get("appointment")
        if appointment_id:
            try:
                appt = Appointment.objects.get(pk=appointment_id, is_deleted=False)
                now_ist = timezone.localtime(timezone.now())
                if now_ist.time() < appt.appointment_time:
                    raise ValidationError(
                        "Consultation cannot start before scheduled time."
                    )
            except Appointment.DoesNotExist:
                pass  # serializer will catch the invalid appointment

        # ── Guard: at least one medicine required ──────────────────────
        if not medicines_data:
            raise ValidationError(
                {"medicines": "At least one medicine is required."}
            )

        # ── Guard: duplicate medicine in the submitted list ────────────
        seen_medicine_ids = set()
        for i, med in enumerate(medicines_data):
            mid = str(med.get("medicine", ""))
            if mid in seen_medicine_ids:
                raise ValidationError(
                    {"medicines": {str(i): {"medicine": ["This medicine is already added."]}}}
                )
            if mid:
                seen_medicine_ids.add(mid)

        with transaction.atomic():
            # ── 1. Validate and create the prescription (DRAFT) ────────
            presc_serializer = PrescriptionSerializer(
                data={
                    "appointment": request.data.get("appointment"),
                    "symptoms":    request.data.get("symptoms", ""),
                    "diagnosis":   request.data.get("diagnosis", ""),
                },
                context={"request": request},
            )
            if not presc_serializer.is_valid():
                raise ValidationError(presc_serializer.errors)

            prescription = presc_serializer.save()

            # ── 2. Validate and create each medicine item ───────────────
            for i, med in enumerate(medicines_data):
                item_serializer = PrescriptionItemSerializer(
                    data={
                        "prescription": prescription.prescription_id,
                        "medicine":     med.get("medicine"),
                        "dosage":       (med.get("dosage") or "").strip(),
                        "frequency":    med.get("frequency", ""),
                        "quantity":     med.get("quantity"),
                    },
                    context={"request": request},
                )
                if not item_serializer.is_valid():
                    # Raise with the row index so the frontend can pin the
                    # error to the exact medicine row that failed.
                    raise ValidationError(
                        {"medicines": {str(i): item_serializer.errors}}
                    )
                item_serializer.save()

            # ── 3. Activate the prescription (DRAFT → ACTIVE) ──────────
            prescription = Prescription.objects.select_for_update().get(
                pk=prescription.pk
            )
            prescription.status = PrescriptionStatus.ACTIVE
            prescription.save()

        # Transaction committed successfully — fire workflow emails.
        if EMAIL_ENABLED:
            # → Patient: prescription ready (legacy)
            try:
                EmailService.send_prescription_ready(prescription)
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(
                    f"Prescription patient email failed: {exc}"
                )
            # → Pharmacists: new prescription to dispense (Trigger 6)
            try:
                EmailService.send_prescription_to_pharmacist(prescription)
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(
                    f"Pharmacist prescription email failed: {exc}"
                )

        return Response(
            {
                "success": True,
                "message": "Prescription created successfully.",
                "data": {
                    "prescription_id":   prescription.prescription_id,
                    "prescription_code": prescription.prescription_code,
                },
            },
            status=status.HTTP_201_CREATED,
        )
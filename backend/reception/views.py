from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import datetime

from .models import Patient, Appointment, ConsultationBill, BillStatus
from .serializers import (
    PatientSerializer,
    AppointmentSerializer,
    ConsultationBillSerializer,
    AppointmentStatusUpdateSerializer   # ✅ ADD THIS
)

from common.permissions import IsReceptionist
from administration.models import DoctorProfile

# Import email service
try:
    from common.email_service import EmailService
    EMAIL_ENABLED = True
except ImportError:
    EMAIL_ENABLED = False


# =========================================================
# DASHBOARD
# =========================================================
class ReceptionDashboardView(APIView):

    permission_classes = [IsAuthenticated, IsReceptionist]

    def get(self, request):

        today = timezone.now().date()

        data = {
            "today_appointments": Appointment.objects.filter(
                appointment_date=today,
                is_deleted=False
            ).count(),

            "total_patients": Patient.objects.filter(
                is_deleted=False
            ).count(),

            "pending_bills": ConsultationBill.objects.filter(
                status="PENDING",
                is_deleted=False
            ).count(),
        }

        return Response(data)


# =========================================================
# PATIENT
# =========================================================
class PatientViewSet(ModelViewSet):

    queryset = Patient.objects.filter(is_deleted=False)
    serializer_class = PatientSerializer
    permission_classes = [IsAuthenticated, IsReceptionist]

    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["gender", "blood_group"]

    search_fields = [
        "first_name",
        "last_name",
        "phone",
        "patient_code"
    ]

    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def perform_destroy(self, instance):
        instance.delete()


# =========================================================
# APPOINTMENT
# =========================================================
class AppointmentViewSet(ModelViewSet):

    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, IsReceptionist]

    http_method_names = ["get", "post", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["doctor", "appointment_date", "status"]

    search_fields = [
        "appointment_code",
        "patient__first_name",
        "patient__last_name",
        "patient__patient_code"
    ]

    ordering_fields = ["appointment_date", "created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Appointment.objects.select_related(
            "patient",
            "doctor",
            "doctor__staff",
            "doctor__staff__user"
        ).filter(is_deleted=False)

    def perform_create(self, serializer):
        """Send email to patient and to the assigned doctor after booking."""
        appointment = serializer.save()

        if EMAIL_ENABLED:
            # → Patient: appointment confirmation (legacy)
            try:
                EmailService.send_appointment_confirmation(appointment)
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(f"Appt confirmation email failed: {exc}")

            # → Doctor: new appointment notification (Trigger 1)
            try:
                receptionist_name = (
                    self.request.user.get_full_name()
                    or self.request.user.username
                )
                EmailService.send_appointment_notification_to_doctor(
                    appointment, receptionist_name
                )
            except Exception as exc:
                import logging
                logging.getLogger('email_service').error(f"Doctor appt notification failed: {exc}")

    def perform_destroy(self, instance):
        instance.delete()

    # Receptionist may only CANCEL scheduled appointments.
    # COMPLETED status is set exclusively by the doctor via prescription submission.
    @action(detail=True, methods=["patch"])
    def update_status(self, request, pk=None):
        appointment = self.get_object()

        requested_status = request.data.get("status")
        if requested_status == "COMPLETED":
            return Response(
                {
                    "success": False,
                    "message": (
                        "Appointments can only be marked completed by the doctor "
                        "when a prescription is submitted."
                    ),
                },
                status=403,
            )

        serializer = AppointmentStatusUpdateSerializer(
            appointment,
            data=request.data,
            partial=True
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)


# =========================================================
# CONSULTATION BILL
# =========================================================
class ConsultationBillViewSet(ModelViewSet):

    queryset = ConsultationBill.objects.select_related(
        "appointment",
        "appointment__patient",
        "appointment__doctor"
    ).filter(is_deleted=False)

    serializer_class = ConsultationBillSerializer
    permission_classes = [IsAuthenticated, IsReceptionist]

    http_method_names = ["get", "patch", "delete"]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]

    search_fields = [
        "bill_code",
        "appointment__patient__patient_code",
        "appointment__patient__first_name"
    ]

    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def perform_destroy(self, instance):
        instance.delete()

    @action(detail=True, methods=["get"], url_path="print")
    def print_bill(self, request, pk=None):
        """
        Return enriched bill data for receipt printing.
        Only PAID bills may be printed — 403 returned for any other status.
        This backend gate prevents bypassing the UI print restriction via
        direct API calls.
        """
        bill = self.get_object()
        if bill.status != BillStatus.PAID:
            return Response(
                {
                    "success": False,
                    "message": "Only paid bills can be printed.",
                },
                status=403,
            )
        serializer = self.get_serializer(bill)
        return Response(serializer.data)


# =========================================================
# DOCTOR LIST (for appointment booking dropdown)
# =========================================================
class DoctorListView(APIView):

    permission_classes = [IsAuthenticated, IsReceptionist]

    def get(self, request):
        doctors = DoctorProfile.objects.select_related(
            "staff__user", "specialization"
        ).filter(is_deleted=False, is_active=True)

        data = [
            {
                "doctor_profile_id": d.doctor_profile_id,
                "doctor_code": d.doctor_code,
                "staff_name": d.staff.user.get_full_name(),
                "specialization_name": d.specialization.name,
                "consultation_fee": str(d.consultation_fee),
                "duty_status": getattr(d, 'duty_status', 'AVAILABLE'),
                "is_bookable": getattr(d, 'is_bookable', True),
            }
            for d in doctors
        ]
        return Response(data)


# =========================================================
# DOCTOR AVAILABILITY
# =========================================================
class DoctorAvailabilityView(APIView):

    permission_classes = [IsAuthenticated, IsReceptionist]

    def get(self, request):

        doctor_id = request.query_params.get("doctor")
        appointment_date = request.query_params.get("date")

        if not doctor_id or not appointment_date:
            return Response(
                {"error": "doctor and date parameters are required"},
                status=400
            )

        # ✅ FIX: DATE VALIDATION
        try:
            appointment_date = datetime.strptime(
                appointment_date, "%Y-%m-%d"
            ).date()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD"},
                status=400
            )

        doctor = DoctorProfile.objects.filter(
            pk=doctor_id,
            is_deleted=False
        ).first()

        if not doctor:
            return Response({"error": "Doctor not found"}, status=404)

        bookings = Appointment.objects.filter(
            doctor_id=doctor_id,
            appointment_date=appointment_date,
            is_deleted=False
        ).count()

        remaining = doctor.max_patient_per_day - bookings

        return Response({
            "doctor_id": doctor_id,
            "daily_limit": doctor.max_patient_per_day,
            "current_bookings": bookings,
            "remaining_slots": max(0, remaining)   # ✅ SAFETY FIX
        })



# =========================================================
# AVAILABLE SLOTS (for time slot picker)
# =========================================================
class AvailableSlotsView(APIView):
    """
    Return available time slots for a doctor on a specific date.

    Response shape:
        {
            "doctor_id":       str,
            "date":            "YYYY-MM-DD",
            "is_scheduled":    bool,   # False = doctor has no schedule on this weekday
            "available_slots": [str],  # HH:MM strings
            "total_available": int
        }
    """

    permission_classes = [IsAuthenticated, IsReceptionist]

    def get(self, request):
        from .slot_validator import get_available_slots
        from datetime import datetime

        doctor_id = request.query_params.get("doctor")
        date_str  = request.query_params.get("date")

        if not doctor_id or not date_str:
            return Response(
                {"error": "doctor and date parameters are required"},
                status=400,
            )

        try:
            date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD"},
                status=400,
            )

        result = get_available_slots(int(doctor_id), date)

        return Response({
            "doctor_id":       doctor_id,
            "date":            date_str,
            "is_scheduled":    result["is_scheduled"],
            "available_slots": result["slots"],
            "total_available": len(result["slots"]),
        })

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from reception.models import Appointment, Patient
from administration.models import DoctorProfile


class LiveAppointmentBoardView(APIView):
    """
    Real-time appointment board - accessible by all authenticated staff.
    Returns today's appointments with live status counts.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localtime(timezone.now()).date()
        now = timezone.localtime(timezone.now())

        appointments = (
            Appointment.objects
            .select_related(
                "patient",
                "doctor",
                "doctor__staff",
                "doctor__staff__user",
                "doctor__specialization",
            )
            .filter(appointment_date=today, is_deleted=False)
            .order_by("appointment_time")
        )

        scheduled = appointments.filter(status="SCHEDULED").count()
        completed = appointments.filter(status="COMPLETED").count()
        cancelled = appointments.filter(status="CANCELLED").count()
        total = appointments.count()

        rows = []
        for a in appointments:
            doctor_user = a.doctor.staff.user
            rows.append({
                "id": a.appointment_id,
                "code": a.appointment_code,
                "token": a.token_number,
                "patient_name": a.patient.full_name,
                "patient_code": a.patient.patient_code,
                "doctor_name": f"Dr. {doctor_user.first_name} {doctor_user.last_name}",
                "specialization": (
                    a.doctor.specialization.name
                    if a.doctor.specialization else "General"
                ),
                "time": a.appointment_time.strftime("%I:%M %p"),
                "status": a.status,
                "completed_at": (
                    timezone.localtime(a.completed_at).strftime("%I:%M %p")
                    if a.completed_at else None
                ),
            })

        return Response({
            "date": today.isoformat(),
            "timestamp": now.isoformat(),
            "summary": {
                "total": total,
                "scheduled": scheduled,
                "completed": completed,
                "cancelled": cancelled,
            },
            "appointments": rows,
        })

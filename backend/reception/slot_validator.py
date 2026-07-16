"""
Appointment Slot Validation & Double-Booking Prevention
Handles concurrency, working hours, and slot availability
"""
from datetime import datetime, timedelta
from django.db import transaction
from django.utils import timezone
import pytz

from reception.models import Appointment
from administration.models import DoctorProfile, DoctorSchedule

IST = pytz.timezone('Asia/Kolkata')

# Must match APPOINTMENT_SLOT_MINUTES in reception/models.py
SLOT_MINUTES = 10


class SlotValidationError(Exception):
    """Raised when slot validation fails. Carries the field name for DRF."""
    def __init__(self, message, field='appointment_time'):
        self.message = message
        self.field = field
        super().__init__(message)


class AppointmentSlotValidator:
    """
    Validates appointment slots with:
      1. Doctor existence check
      2. Past date/time rejection (IST)
      3. No schedule on selected day → field error (was previously bypassed
         by a default 9 AM–6 PM fallback that generated fake slots)
      4. Time within schedule window
      5. 10-minute interval alignment
      6. Patient cross-doctor conflict check (patient already booked at same time)
      7. Atomic double-booking check (select_for_update) — doctor slot
    """

    def __init__(self, doctor_id, appointment_date, appointment_time,
                 exclude_appointment_id=None, patient_id=None):
        self.doctor_id = doctor_id
        self.appointment_date = appointment_date
        self.appointment_time = appointment_time
        self.exclude_appointment_id = exclude_appointment_id
        self.patient_id = patient_id
        self.doctor = None
        self.schedule = None

    def validate(self):
        """Run all validations in order. Raises SlotValidationError on first failure."""
        self._load_doctor()
        self._validate_past_datetime()
        self._validate_schedule_exists()
        self._validate_working_hours()
        self._validate_slot_interval()
        self._validate_patient_conflict()
        self._validate_slot_available()
        return True

    # ------------------------------------------------------------------
    # Step 1 — Doctor lookup
    # ------------------------------------------------------------------

    def _load_doctor(self):
        """Load doctor and their active schedule for the selected day of week."""
        try:
            self.doctor = DoctorProfile.objects.select_related('staff').get(
                doctor_profile_id=self.doctor_id,
                is_deleted=False,
                is_active=True,
            )
        except DoctorProfile.DoesNotExist:
            raise SlotValidationError(
                "Doctor not found or not available.", 'doctor'
            )

        day_of_week = self.appointment_date.strftime('%A').upper()  # e.g. "SATURDAY"
        self.schedule = DoctorSchedule.objects.filter(
            doctor=self.doctor,
            day_of_week=day_of_week,
            is_deleted=False,
            is_active=True,
        ).first()

    # ------------------------------------------------------------------
    # Step 2 — Past date/time (IST)
    # ------------------------------------------------------------------

    def _validate_past_datetime(self):
        """Reject bookings in the past, evaluated strictly in IST."""
        now_ist = timezone.now().astimezone(IST)
        today_ist = now_ist.date()

        if self.appointment_date < today_ist:
            raise SlotValidationError(
                "Cannot book an appointment for a past date.",
                'appointment_date',
            )

        if self.appointment_date == today_ist and self.appointment_time <= now_ist.time():
            raise SlotValidationError(
                "Cannot book an appointment for a past time slot. "
                "Please select a future time.",
                'appointment_time',
            )

    # ------------------------------------------------------------------
    # Step 3 — Schedule existence on selected day
    # ------------------------------------------------------------------

    def _validate_schedule_exists(self):
        """
        CRITICAL FIX: Reject immediately if the doctor has no active schedule
        on the selected day of week.

        Previously, the code fell through to a default 9 AM–6 PM window when
        no schedule existed, causing slots to appear on unscheduled days.
        """
        if self.schedule is None:
            day_name = self.appointment_date.strftime('%A')  # e.g. "Saturday"
            raise SlotValidationError(
                f"Doctor is not scheduled on {day_name}s. "
                f"Please select a different date.",
                'appointment_date',
            )

    # ------------------------------------------------------------------
    # Step 4 — Time within schedule window
    # ------------------------------------------------------------------

    def _validate_working_hours(self):
        """Verify the requested time falls within the doctor's schedule window.
        self.schedule is guaranteed non-None at this point."""
        if self.appointment_time < self.schedule.start_time:
            raise SlotValidationError(
                f"Appointment time is before the doctor's working hours "
                f"(starts at {self.schedule.start_time.strftime('%I:%M %p')}).",
                'appointment_time',
            )

        if self.appointment_time >= self.schedule.end_time:
            raise SlotValidationError(
                f"Appointment time is after the doctor's working hours "
                f"(ends at {self.schedule.end_time.strftime('%I:%M %p')}).",
                'appointment_time',
            )

    # ------------------------------------------------------------------
    # Step 5 — 10-minute interval alignment
    # ------------------------------------------------------------------

    def _validate_slot_interval(self):
        """Appointment time must align to SLOT_MINUTES boundaries from schedule start."""
        schedule_start_dt = datetime.combine(
            self.appointment_date, self.schedule.start_time
        )
        appointment_dt = datetime.combine(
            self.appointment_date, self.appointment_time
        )
        minutes_from_start = int(
            (appointment_dt - schedule_start_dt).total_seconds() / 60
        )
        if minutes_from_start % SLOT_MINUTES != 0:
            raise SlotValidationError(
                f"Appointment time must follow {SLOT_MINUTES}-minute intervals.",
                'appointment_time',
            )

    # ------------------------------------------------------------------
    # Step 6 — Patient cross-doctor conflict check
    # ------------------------------------------------------------------

    def _validate_patient_conflict(self):
        """
        Prevent a patient from booking two appointments at the same date/time
        with different doctors. A patient can only have ONE appointment per
        time slot across ALL doctors.
        """
        if not self.patient_id:
            return  # Skip if no patient provided (safety guard)

        with transaction.atomic():
            conflicting = Appointment.objects.select_for_update().filter(
                patient_id=self.patient_id,
                appointment_date=self.appointment_date,
                appointment_time=self.appointment_time,
                is_deleted=False,
                status__in=['SCHEDULED', 'COMPLETED'],
            )

            if self.exclude_appointment_id:
                conflicting = conflicting.exclude(
                    appointment_id=self.exclude_appointment_id
                )

            if conflicting.exists():
                raise SlotValidationError(
                    "Patient already has an appointment in this time slot.",
                    'appointment_time',
                )

    # ------------------------------------------------------------------
    # Step 7 — Atomic double-booking check (doctor slot)
    # ------------------------------------------------------------------

    def _validate_slot_available(self):
        """
        Exact-time double-booking check using select_for_update inside an
        atomic block to prevent race conditions on concurrent requests.
        """
        with transaction.atomic():
            conflicting = Appointment.objects.select_for_update().filter(
                doctor_id=self.doctor_id,
                appointment_date=self.appointment_date,
                appointment_time=self.appointment_time,
                is_deleted=False,
                status__in=['SCHEDULED', 'COMPLETED'],
            )

            if self.exclude_appointment_id:
                conflicting = conflicting.exclude(
                    appointment_id=self.exclude_appointment_id
                )

            if conflicting.exists():
                existing = conflicting.first()
                raise SlotValidationError(
                    f"This time slot is already booked "
                    f"(Token #{existing.token_number} at "
                    f"{existing.appointment_time.strftime('%I:%M %p')}).",
                    'appointment_time',
                )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_appointment_slot(doctor_id, appointment_date, appointment_time,
                              exclude_id=None, patient_id=None):
    """
    Validate an appointment slot.

    Raises SlotValidationError with .field and .message if invalid.
    Returns True if valid.

    patient_id: when provided, also checks that the patient has no conflicting
    appointment at the same date/time with any other doctor.
    """
    AppointmentSlotValidator(
        doctor_id=doctor_id,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
        exclude_appointment_id=exclude_id,
        patient_id=patient_id,
    ).validate()
    return True


def get_available_slots(doctor_id, date):
    """
    Return available time slots for a doctor on a specific date.

    Returns a dict:
        {
            'is_scheduled': bool,   # False = doctor has no schedule on this day
            'slots': [str, ...],    # HH:MM strings; empty when is_scheduled=False
                                    # or when all slots are booked/past
        }

    CRITICAL FIX: Previously returned default 9 AM–6 PM slots when no schedule
    existed, causing slots to appear on days the doctor does not work.
    Now returns is_scheduled=False and an empty list immediately.
    """
    try:
        doctor = DoctorProfile.objects.get(
            doctor_profile_id=doctor_id,
            is_deleted=False,
            is_active=True,
        )
    except DoctorProfile.DoesNotExist:
        return {'is_scheduled': False, 'slots': []}

    # Convert the date to the correct day-of-week string (MONDAY…SUNDAY)
    # date.strftime('%A') uses the platform locale — normalise to upper-case
    # to match DayOfWeekChoices in administration/models.py.
    day_of_week = date.strftime('%A').upper()

    schedule = DoctorSchedule.objects.filter(
        doctor=doctor,
        day_of_week=day_of_week,
        is_deleted=False,
        is_active=True,
    ).first()

    # ── No schedule on this day of week ───────────────────────────────────
    # Return immediately — do NOT fall back to default hours.
    if schedule is None:
        return {'is_scheduled': False, 'slots': []}

    # ── Generate all slots at SLOT_MINUTES intervals ──────────────────────
    all_slots = []
    current = datetime.combine(date, schedule.start_time)
    end_dt  = datetime.combine(date, schedule.end_time)

    while current < end_dt:
        all_slots.append(current.time())
        current += timedelta(minutes=SLOT_MINUTES)

    # ── Fetch booked times for this doctor/date ───────────────────────────
    booked_times = set(
        Appointment.objects.filter(
            doctor_id=doctor_id,
            appointment_date=date,
            is_deleted=False,
            status__in=['SCHEDULED', 'COMPLETED'],
        ).values_list('appointment_time', flat=True)
    )

    # Current IST moment for same-day past-slot filtering
    now_ist = timezone.now().astimezone(IST)

    available = []
    for slot in all_slots:
        if slot in booked_times:
            continue
        # For today: skip slots that are already in the past (IST)
        if date == now_ist.date() and slot <= now_ist.time():
            continue
        available.append(slot.strftime('%H:%M'))

    return {'is_scheduled': True, 'slots': available}

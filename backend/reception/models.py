from django.db import models, transaction , IntegrityError
from django.core.validators import MinValueValidator, RegexValidator
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Max, Q
from datetime import datetime
import re
from common.models import BaseModel
from administration.models import DoctorProfile, DoctorSchedule

APPOINTMENT_SLOT_MINUTES = 10

class GenderChoices(models.TextChoices):
    MALE = "MALE", "Male"
    FEMALE = "FEMALE", "Female"
    OTHER = "OTHER", "Other"


class BloodGroupChoices(models.TextChoices):
    A_POS = "A+", "A+"
    A_NEG = "A-", "A-"
    B_POS = "B+", "B+"
    B_NEG = "B-", "B-"
    AB_POS = "AB+", "AB+"
    AB_NEG = "AB-", "AB-"
    O_POS = "O+", "O+"
    O_NEG = "O-", "O-"


class AppointmentStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Scheduled"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class BillStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PAID = "PAID", "Paid"
    CANCELLED = "CANCELLED", "Cancelled"


class PatientStatus(models.TextChoices):
    REGISTERED = "REGISTERED", "Registered"
    UNDER_CARE = "UNDER_CARE", "Under Care"
    ARCHIVED = "ARCHIVED", "Archived"


class Patient(BaseModel):

    patient_id = models.AutoField(primary_key=True)

    patient_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    gender = models.CharField(
        max_length=10,
        choices=GenderChoices.choices
    )

    blood_group = models.CharField(
        max_length=5,
        choices=BloodGroupChoices.choices
    )

    date_of_birth = models.DateField()

    phone = models.CharField(
        max_length=15,
        validators=[RegexValidator(r"^\+?\d{10,15}$")]
    )

    email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Patient email for notifications"
    )


    emergency_contact_number = models.CharField(
        max_length=15,
        validators=[RegexValidator(r"^\+?\d{10,15}$")]
    )

    address = models.TextField()

    patient_status = models.CharField(
        max_length=20,
        choices=PatientStatus.choices,
        default=PatientStatus.REGISTERED,
        db_index=True,
        help_text="Current patient lifecycle status"
    )
    
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


    @property
    def age(self):
        today = timezone.now().date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) <
            (self.date_of_birth.month, self.date_of_birth.day)
        )
    

    class Meta:
        db_table = "patients"
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["patient_code"]),
            models.Index(fields=["is_deleted"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["phone"],
                condition=Q(is_deleted=False),
                name="unique_active_patient_phone"
            ),
            
        ]

    def clean(self):
        today = timezone.now().date()

        # ── Name validation ──────────────────────────────────────────────
        for field_val, label in [
            (self.first_name, "First name"),
            (self.last_name, "Last name"),
        ]:
            v = (field_val or "").strip()
            if not v:
                raise ValidationError(f"{label} is required.")
            if len(v) < 3:
                raise ValidationError(f"{label} must be at least 3 characters.")
            if len(v) > 50:
                raise ValidationError(f"{label} must not exceed 50 characters.")
            if not re.fullmatch(r"[A-Za-z]+", v):
                raise ValidationError(
                    f"{label} must contain letters only (no numbers or symbols)."
                )
            if re.search(r"(.)\1{2,}", v, re.IGNORECASE):
                raise ValidationError(
                    f"{label} cannot have more than 2 consecutive identical characters."
                )

        # ── Date of birth ────────────────────────────────────────────────
        if not self.date_of_birth:
            raise ValidationError("Date of birth required.")

        if self.date_of_birth >= today:
            raise ValidationError("Invalid date of birth.")

        age = today.year - self.date_of_birth.year - (
            (today.month, today.day) <
            (self.date_of_birth.month, self.date_of_birth.day)
        )
        if age > 120:
            raise ValidationError("Unrealistic age.")

        # ── Phone validation ─────────────────────────────────────────────
        for phone_val, label in [
            (self.phone, "Phone"),
            (self.emergency_contact_number, "Emergency contact"),
        ]:
            digits = re.sub(r"^\+91", "", (phone_val or "").strip())
            if not digits:
                raise ValidationError(f"{label} is required.")
            if not re.fullmatch(r"\d{10}", digits):
                raise ValidationError(
                    f"{label} must be exactly 10 digits (optional +91 prefix)."
                )
            if not re.match(r"^[6-9]", digits):
                raise ValidationError(f"{label} must start with 6, 7, 8, or 9.")
            if len(set(digits)) == 1:
                raise ValidationError(f"{label} cannot be all identical digits.")
            ascending = "".join(str((int(digits[0]) + i) % 10) for i in range(10))
            if digits == ascending:
                raise ValidationError(f"{label} cannot be a sequential pattern.")
            if len(set(digits)) < 4:
                raise ValidationError(
                    f"{label} must contain at least 4 different digits."
                )

        if self.phone == self.emergency_contact_number:
            raise ValidationError("Emergency contact number cannot be the same as patient phone.")

        # ── Address validation ───────────────────────────────────────────
        addr = " ".join((self.address or "").split())
        if not addr or len(addr) < 5:
            raise ValidationError("Address must be at least 5 characters.")
        if len(addr) > 100:
            raise ValidationError("Address must not exceed 100 characters.")
        if not re.fullmatch(r"[A-Za-z0-9\s.,\-()']+", addr):
            raise ValidationError(
                "Address may only contain letters, numbers, spaces, and . , - ( ) '"
            )
        if not re.search(r"[A-Za-z]", addr):
            raise ValidationError("Address must contain at least one letter.")
        if re.search(r"(.)\1{3,}", addr):
            raise ValidationError(
                "Address cannot have more than 3 consecutive identical characters."
            )

        # ── Gender / blood group ─────────────────────────────────────────
        if self.gender not in GenderChoices.values:
            raise ValidationError("Invalid gender.")

        if self.blood_group not in BloodGroupChoices.values:
            raise ValidationError("Invalid blood group.")

        # ── Immutability ─────────────────────────────────────────────────
        if self.pk and self.patient_code:
            original = Patient.objects.filter(pk=self.pk).first()
            if (
                original
                and original.patient_code
                and original.patient_code != self.patient_code
            ):
                raise ValidationError("Patient code immutable.")


    def save(self, *args, **kwargs):
        is_new = self.pk is None

        with transaction.atomic():
            self.full_clean()
            super().save(*args, **kwargs)

            if is_new:
                self.patient_code = f"PT{str(self.patient_id).zfill(6)}"
                super().save(update_fields=["patient_code"])

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.appointments.filter(is_deleted=False).exists():
                raise ValidationError("Cannot delete patient with active appointments.")

            self.is_deleted = True
            self.save(update_fields=["is_deleted"])

    def __str__(self):
        return f"{self.patient_code} - {self.first_name} {self.last_name}"
    
    



class Appointment(BaseModel):

    appointment_id = models.AutoField(primary_key=True)

    appointment_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    token_number = models.PositiveIntegerField(editable=False)

    patient = models.ForeignKey(
        "reception.Patient",
        on_delete=models.PROTECT,
        related_name="appointments"
    )

    doctor = models.ForeignKey(
        "administration.DoctorProfile",
        on_delete=models.PROTECT,
        related_name="appointments"
    )

    appointment_date = models.DateField(db_index=True)
    appointment_time = models.TimeField()

    status = models.CharField(
        max_length=20,
        choices=AppointmentStatus.choices,
        default=AppointmentStatus.SCHEDULED,
        db_index=True
    )

    completed_at = models.DateTimeField(null=True, blank=True)

    STATE_MACHINE = {
        AppointmentStatus.SCHEDULED: {
            AppointmentStatus.COMPLETED,
            AppointmentStatus.CANCELLED,
        },
        AppointmentStatus.COMPLETED: set(),
        AppointmentStatus.CANCELLED: set(),
    }

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "appointment_date", "token_number"],
                condition=Q(is_deleted=False),
                name="unique_token_per_doctor_per_day"
            ),
            models.UniqueConstraint(
                fields=["doctor", "appointment_date", "appointment_time"],
                condition=Q(is_deleted=False),
                name="unique_timeslot_per_doctor"
            ),
            # A patient can only have ONE appointment per time slot (any doctor)
            models.UniqueConstraint(
                fields=["patient", "appointment_date", "appointment_time"],
                condition=Q(is_deleted=False),
                name="unique_timeslot_per_patient"
            ),
            models.CheckConstraint(
                condition=Q(token_number__gt=0),
                name="token_positive_check"
            ),
            models.CheckConstraint(
                condition=Q(version__gt=0),
                name="appointment_version_positive"
            ),
            models.CheckConstraint(
                condition=(
                    Q(status=AppointmentStatus.COMPLETED, completed_at__isnull=False) |
                    ~Q(status=AppointmentStatus.COMPLETED)
                ),
                name="completed_requires_timestamp"
            ),
        ]

    def clean(self):
        if not self.patient_id:
            raise ValidationError("Patient required.")

        if self.patient.is_deleted:
            raise ValidationError("Patient inactive.")

        # Prevent booking for ARCHIVED patients
        if hasattr(self.patient, 'patient_status') and self.patient.patient_status == 'ARCHIVED':
            raise ValidationError("Cannot book appointment for archived patient.")

        if not self.doctor_id:
            raise ValidationError("Doctor required.")

        if self.doctor.is_deleted or not self.doctor.is_active:
            raise ValidationError("Doctor unavailable.")

        # Enforce duty status: cannot book OFF_DUTY doctors
        if hasattr(self.doctor, 'duty_status') and self.doctor.duty_status == 'OFF_DUTY':
            raise ValidationError("Cannot book appointment with an off-duty doctor.")

        if not self.appointment_date or not self.appointment_time:
            raise ValidationError("Appointment date and time required.")

        # strftime('%A') is locale-independent for weekday name in Python stdlib;
        # upper() normalises to match DayOfWeekChoices (MONDAY…SUNDAY).
        weekday = self.appointment_date.strftime("%A").upper()

        day_schedules = DoctorSchedule.objects.filter(
            doctor=self.doctor,
            day_of_week=weekday,
            is_deleted=False,
            is_active=True,
        )

        # ── Check 1: Does the doctor work on this day at all? ─────────────
        if not day_schedules.exists():
            day_name = self.appointment_date.strftime("%A")  # e.g. "Saturday"
            raise ValidationError(
                f"Doctor is not scheduled on {day_name}s. "
                f"Please select a different date."
            )

        # ── Check 2: Does the chosen time fall within a schedule window? ──
        schedule = day_schedules.filter(
            start_time__lte=self.appointment_time,
            end_time__gt=self.appointment_time,
        ).first()
        if not schedule:
            raise ValidationError(
                "The selected time is outside the doctor's working hours on this day."
            )

        schedule_start = datetime.combine(self.appointment_date, schedule.start_time)
        appointment_dt = datetime.combine(self.appointment_date, self.appointment_time)

        minutes_from_start = int((appointment_dt - schedule_start).total_seconds() / 60)

        if minutes_from_start % APPOINTMENT_SLOT_MINUTES != 0:
            raise ValidationError(
                f"Appointments must follow {APPOINTMENT_SLOT_MINUTES}-minute intervals."
            )

        if timezone.is_naive(appointment_dt):
            appointment_dt = timezone.make_aware(
                appointment_dt,
                timezone.get_current_timezone()
            )

        if not self.pk and appointment_dt < timezone.now():
            raise ValidationError("Appointment must be future.")

        # Prevent patient from holding two appointments at the same date/time
        # with different doctors (cross-doctor conflict check)
        if not self.pk:
            patient_conflict = Appointment.objects.filter(
                patient=self.patient,
                appointment_date=self.appointment_date,
                appointment_time=self.appointment_time,
                is_deleted=False,
                status__in=[AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED],
            ).exists()
            if patient_conflict:
                raise ValidationError(
                    "Patient already has an appointment in this time slot."
                )

        if self.pk:
            original = Appointment.objects.select_for_update().get(pk=self.pk)

            # ❌ REMOVED VERSION CHECK

            if original.status in {
                AppointmentStatus.COMPLETED,
                AppointmentStatus.CANCELLED
            }:
                raise ValidationError("Finalized appointment immutable.")

            # Immutable fields
            if original.patient_id != self.patient_id:
                raise ValidationError("Patient cannot be changed.")

            if original.doctor_id != self.doctor_id:
                raise ValidationError("Doctor cannot be changed.")

            if original.appointment_date != self.appointment_date:
                raise ValidationError("Appointment date cannot be changed.")

            if original.appointment_time != self.appointment_time:
                raise ValidationError("Appointment time cannot be changed.")

            # Status transition
            if original.status != self.status:
                allowed = self.STATE_MACHINE.get(original.status, set())
                if self.status not in allowed:
                    raise ValidationError("Invalid transition.")

                paid_bill = ConsultationBill.objects.filter(
                    appointment=original,
                    status=BillStatus.PAID,
                    is_deleted=False
                ).exists()

                if paid_bill and self.status == AppointmentStatus.CANCELLED:
                    raise ValidationError("Cannot cancel paid appointment.")

                if self.status == AppointmentStatus.COMPLETED and not paid_bill:
                    raise ValidationError("Payment required before completion.")

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        with transaction.atomic():

            if is_new:
                doctor = DoctorProfile.objects.select_for_update().filter(pk=self.doctor_id).first()
                if not doctor:
                    raise ValidationError("Doctor does not exist.")

                qs = Appointment.objects.select_for_update().filter(
                    doctor=self.doctor,
                    appointment_date=self.appointment_date,
                    is_deleted=False
                )

                if qs.count() >= self.doctor.max_patient_per_day:
                    raise ValidationError("Doctor daily capacity exceeded.")

                max_token = qs.aggregate(Max("token_number"))["token_number__max"]
                self.token_number = (max_token or 0) + 1

                self.full_clean()
                super().save(*args, **kwargs)

                self.appointment_code = f"AP{str(self.appointment_id).zfill(6)}"
                Appointment.objects.filter(pk=self.pk).update(
                    appointment_code=self.appointment_code
                )

                ConsultationBill.objects.create(
                    appointment=self,
                    version=1
                )

            else:
                if self.status == AppointmentStatus.COMPLETED and not self.completed_at:
                    self.completed_at = timezone.now()

                self.full_clean()

                self.version += 1  # ✅ correct
                super().save(*args, **kwargs)

                # ── CASCADE: cancel bill when appointment is cancelled ──
                if self.status == AppointmentStatus.CANCELLED:
                    bill = ConsultationBill.objects.filter(
                        appointment=self,
                        is_deleted=False
                    ).exclude(status=BillStatus.PAID).first()
                    if bill:
                        bill.status = BillStatus.CANCELLED
                        bill.version += 1
                        ConsultationBill.objects.filter(pk=bill.pk).update(
                            status=BillStatus.CANCELLED,
                            version=bill.version,
                        )

    def __str__(self):
        return f"{self.appointment_code} - {self.patient.patient_code}"


class ConsultationBill(BaseModel):

    consultation_bill_id = models.AutoField(primary_key=True)

    bill_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    appointment = models.OneToOneField(
        "reception.Appointment",
        on_delete=models.PROTECT,
        related_name="consultation_bill"
    )

    registration_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=100
    )

    consultation_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    status = models.CharField(
        max_length=20,
        choices=BillStatus.choices,
        default=BillStatus.PENDING,
        db_index=True
    )

    paid_at = models.DateTimeField(null=True, blank=True)

    STATE_MACHINE = {
        BillStatus.PENDING: {BillStatus.PAID, BillStatus.CANCELLED},
        BillStatus.PAID: set(),
        BillStatus.CANCELLED: set(),
    }

    class Meta:
        constraints = [

            models.CheckConstraint(
                condition=Q(consultation_fee__gte=0),
                name="consultation_fee_positive"
            ),

            models.CheckConstraint(
                condition=Q(registration_fee__gte=0),
                name="registration_fee_positive"
            ),

            models.CheckConstraint(
                condition=Q(total_amount__gte=0),
                name="consultation_bill_total_positive"
            ),
            models.CheckConstraint(
                condition=Q(version__gt=0),
                name="bill_version_positive"
            ),
            
            models.CheckConstraint(
                condition=(
                    Q(status=BillStatus.PAID, paid_at__isnull=False) |
                    ~Q(status=BillStatus.PAID)
                ),
                name="paid_requires_timestamp"
            ),
        ]

    def clean(self):
        if not self.appointment_id:
            raise ValidationError("Appointment required.")

        if self.appointment.status == AppointmentStatus.CANCELLED:
            raise ValidationError("Cannot bill cancelled appointment.")

        if self.pk:
            original = ConsultationBill.objects.select_for_update().get(pk=self.pk)

            # ❌ REMOVED VERSION CHECK

            if original.status == BillStatus.PAID:
                raise ValidationError("Paid bill immutable.")

            if original.total_amount != self.total_amount:
                raise ValidationError("Amount immutable.")

            if original.status != self.status:
                allowed = self.STATE_MACHINE.get(original.status, set())
                if self.status not in allowed:
                    raise ValidationError("Invalid status transition.")
                if self.status == BillStatus.PAID and self.total_amount <= 0:
                    raise ValidationError(
                        "Cannot mark bill as Paid: bill amount must be greater than zero."
                    )

            if self.status == BillStatus.CANCELLED and \
                self.appointment.status == AppointmentStatus.COMPLETED:
                raise ValidationError(
                    "Cannot cancel bill for completed appointment."
                )

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        with transaction.atomic():

            appointment = Appointment.objects.select_for_update().filter(
                pk=self.appointment_id
            ).first()

            if not appointment:
                raise ValidationError("Appointment not found.")

            if appointment.is_deleted:
                raise ValidationError("Cannot bill deleted appointment.")

            if is_new:
                if ConsultationBill.objects.filter(appointment=self.appointment).exists():
                    raise ValidationError("Bill already exists.")

                if appointment.doctor.consultation_fee is None:
                    raise ValidationError("Doctor consultation fee not configured.")

                previous_visits = appointment.patient.appointments.filter(
                    is_deleted=False
                ).exclude(pk=appointment.pk).exists()

                self.registration_fee = 0 if previous_visits else 100
                self.consultation_fee = appointment.doctor.consultation_fee
                self.total_amount = self.registration_fee + self.consultation_fee

            if self.status == BillStatus.PAID and not self.paid_at:
                self.paid_at = timezone.now()

            self.full_clean()

            if not is_new:
                self.version += 1  # ✅ FIX ADDED

            super().save(*args, **kwargs)

            if is_new:
                self.bill_code = f"BL{str(self.consultation_bill_id).zfill(6)}"
                super().save(update_fields=["bill_code"])

    def delete(self, *args, **kwargs):

        if self.status == BillStatus.PAID:
            raise ValidationError("Cannot delete paid bill.")

        self.is_deleted = True
        self.save(update_fields=["is_deleted"])
    
    def __str__(self):
        return f"{self.bill_code} - {self.status}"
import re

from django.db import models, transaction
from django.conf import settings
from django.core.validators import (
    MinValueValidator,
    MaxValueValidator,
    RegexValidator
)
from django.core.exceptions import ValidationError
from django.db.models import Q
from datetime import date
from django.utils.timezone import now

from common.models import BaseModel


def validate_phone_no_repeated_digits(value):
    """Reject phone numbers that are all identical, sequential, or have <4 unique digits."""
    digits = re.sub(r'^\+91', '', value)
    if not digits:
        return
    # All identical digits
    if len(set(digits)) == 1:
        raise ValidationError("Phone number cannot consist of all identical digits.")
    # Sequential ascending: 1234567890
    if digits == ''.join(str(i % 10) for i in range(int(digits[0]), int(digits[0]) + 10)):
        raise ValidationError("Phone number cannot be a sequential pattern.")
    # Entropy check: minimum 4 unique digits
    if len(set(digits)) < 4:
        raise ValidationError("Phone number must contain at least 4 different digits.")

# =========================================================
# GENDER CHOICES
# =========================================================

class GenderChoices(models.TextChoices):
    MALE = "MALE", "Male"
    FEMALE = "FEMALE", "Female"
    OTHER = "OTHER", "Other"



# =========================================================
# STAFF STATUS ENUM
# =========================================================

class StaffStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
    ON_LEAVE = "ON_LEAVE", "On Leave"


# =========================================================
# DOCTOR DUTY STATUS ENUM
# =========================================================

class DoctorDutyStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    OFF_DUTY = "OFF_DUTY", "Off Duty"


# =========================================================
# STAFF
# =========================================================

class Staff(BaseModel):
    staff_id = models.AutoField(primary_key=True)
    staff_code = models.CharField(max_length=20, unique=True, blank=True)

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="staff_profile"
    )

    gender = models.CharField(max_length=10, choices=GenderChoices.choices)
    date_of_birth = models.DateField()

    phone = models.CharField(
        max_length=15,
        unique=True,
        validators=[
            RegexValidator(
                regex=r"^(\+91)?[6-9]\d{9}$",
                message="Enter valid Indian phone number (10 digits starting with 6–9, optional +91)."
            ),
            validate_phone_no_repeated_digits,
        ]
    )

    address = models.TextField()
    qualification = models.CharField(max_length=255)

    salary = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(1000),
            MaxValueValidator(1_000_000)
        ]
    )

    is_active = models.BooleanField(default=True)

    staff_status = models.CharField(
        max_length=20,
        choices=StaffStatus.choices,
        default=StaffStatus.ACTIVE,
        db_index=True,
        help_text="Operational status of the staff member"
    )

    # Profile picture is now compulsory
    profile_picture = models.ImageField(
        upload_to="staff/profile_pictures/",
        blank=False,
        null=False
    )
    
    
    @property
    def full_name(self):
        name = self.user.get_full_name()
        return name if name else self.user.username


    @property
    def role(self):
        group = self.user.groups.first()
        return group.name if group else None
    

    class Meta:
        db_table = "staff"
        ordering = ["-created_at"]

    def clean(self):
        today = date.today()

        if self.date_of_birth >= today:
            raise ValidationError({"date_of_birth": "Date of birth must be in the past."})

        age = today.year - self.date_of_birth.year - (
            (today.month, today.day) <
            (self.date_of_birth.month, self.date_of_birth.day)
        )

        if age < 21 or age > 60:
            raise ValidationError({"date_of_birth": "Staff age must be between 21 and 60 years."})

        if not self.address or not self.address.strip():
            raise ValidationError({"address": "Address cannot be blank."})

        addr = self.address.strip()
        if len(addr) < 5:
            raise ValidationError({"address": "Address must contain at least 5 characters."})
        if len(addr) > 100:
            raise ValidationError({"address": "Address must not exceed 100 characters."})
        if not re.match(r'^[A-Za-z0-9\s.,\-()\']+$', addr):
            raise ValidationError({"address": "Address contains invalid characters."})
        if re.search(r'(.)\1{3,}', addr):
            raise ValidationError({"address": "Address cannot have more than 3 consecutive identical characters."})

        if not self.qualification or not self.qualification.strip():
            raise ValidationError({"qualification": "Qualification cannot be blank."})

        qual = self.qualification.strip()
        if len(qual) < 3:
            raise ValidationError({"qualification": "Qualification must contain at least 3 characters."})
        if not re.search(r'[A-Za-z]', qual):
            raise ValidationError({"qualification": "Qualification must contain at least one letter."})
        if re.search(r'(.)\1{2,}', qual):
            raise ValidationError({"qualification": "Qualification cannot have more than 2 consecutive identical characters."})
        if re.search(r'^[^A-Za-z]+$', qual):
            raise ValidationError({"qualification": "Qualification cannot be symbols/numbers only."})

        if not self.profile_picture:
            raise ValidationError({"profile_picture":"Profile picture is mandatory."})

        if self.user_id and not self.is_active and getattr(self.user, "is_active", False):
            raise ValidationError({"is_active":"Inactive staff cannot have active login."})
        

        # Normalize stored values
        self.address = self.address.strip()
        self.qualification = self.qualification.strip()

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        with transaction.atomic():
            self.full_clean()
            super().save(*args, **kwargs)
            
            #updated
            if is_new and not self.staff_code:
                self.staff_code = f"ST{self.pk:03d}"
                Staff.objects.filter(pk=self.pk).update(staff_code=self.staff_code)

    def deactivate_operational(self):
        if not self.is_active:
            return
        
        with transaction.atomic():
            self.is_active = False
            self.version += 1
            self.save(update_fields=["is_active", "version", "updated_at"])

    def deactivate_system(self):
        if not self.is_active and not self.user.is_active:
            return

        with transaction.atomic():
            self.is_active = False
            self.staff_status = StaffStatus.INACTIVE
            self.version += 1

            self.user.is_active = False
            self.user.save(update_fields=["is_active"])

            self.save(update_fields=["is_active", "staff_status", "version", "updated_at"])

            # Sync linked doctor profiles and their schedules
            doctors = DoctorProfile.objects.filter(
                staff=self,
                is_deleted=False
            )

            doctors.update(is_active=False, duty_status=DoctorDutyStatus.OFF_DUTY)

            DoctorSchedule.objects.filter(
                doctor__in=doctors,
                is_deleted=False
            ).update(is_active=False)

    def activate(self):
        if self.is_active:
            return

        with transaction.atomic():
            self.is_active = True
            self.staff_status = StaffStatus.ACTIVE
            self.version += 1

            self.user.is_active = True
            self.user.save(update_fields=["is_active"])

            self.save(update_fields=["is_active", "staff_status", "version", "updated_at"])

            # Sync linked doctor profiles and their schedules
            doctors = DoctorProfile.objects.filter(
                staff=self,
                is_deleted=False
            )

            doctors.update(is_active=True, duty_status=DoctorDutyStatus.AVAILABLE)

            DoctorSchedule.objects.filter(
                doctor__in=doctors,
                is_deleted=False
            ).update(is_active=True)
            
    def delete(self, *args, **kwargs):
        if self.is_deleted:
            return

        with transaction.atomic():
            # self.is_deleted = True
            # self.is_active = False
            # self.version += 1
            # self.user.is_active = False
            self.user.is_active = False
            self.user.save(update_fields=["is_active"])

            Staff.objects.filter(pk=self.pk).update(
                is_deleted=True,
                is_active=False,
                version=self.version + 1,
                updated_at=now()
            )
            doctor_profile = getattr(self, "doctor_profile", None)
            #TO DO: Handle cascading soft delete for all role profiles (labtechnician, pharmacist, etc.)
            if doctor_profile and not doctor_profile.is_deleted:

                # soft delete doctor
                DoctorProfile.objects.filter(pk=doctor_profile.pk).update(
                    is_deleted=True,
                    is_active=False,
                    version=models.F("version") + 1,
                    updated_at=now()
                )

                # cascade schedules
                DoctorSchedule.objects.filter(
                    doctor=doctor_profile,
                    is_deleted=False
                ).update(
                    is_deleted=True,
                    is_active=False,
                    version=models.F("version") + 1,
                    updated_at=now()
                )

    def __str__(self):
        return f"{self.staff_code} - {self.user.username}"


# =========================================================
# SPECIALIZATION
# =========================================================

class Specialization(BaseModel):
    specialization_id = models.AutoField(primary_key=True)

    name = models.CharField(
        max_length=150,
        unique=True,
        validators=[
            RegexValidator(
                regex=r"^[A-Za-z\s]+$",
                message="Specialization must contain letters and spaces only."
            )
        ]
    )

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "specializations"
        ordering = ["name"]

    def clean(self):
        if not self.name or not self.name.strip():
            raise ValidationError({"name": "Specialization cannot be blank."})

        name = self.name.strip()

        if len(name) < 3:
            raise ValidationError({"name": "Specialization must contain at least 3 characters."})

        if len(name) > 100:
            raise ValidationError({"name": "Specialization must not exceed 100 characters."})

        if not re.match(r'^[A-Za-z\s]+$', name):
            raise ValidationError({"name": "Specialization must contain letters and spaces only."})

        # Reject more than 2 consecutive identical characters (e.g. caaaardiology, ennnnnt)
        if re.search(r'(.)\1{2,}', name, re.IGNORECASE):
            raise ValidationError({"name": "Specialization cannot have more than 2 consecutive identical characters."})

        # Reject repeating short patterns (e.g. fdfdfdfdf → 'fd' repeated)
        if re.search(r'(.{2,4})\1{2,}', name, re.IGNORECASE):
            raise ValidationError({"name": "Specialization appears to be a meaningless repeated pattern."})

        self.name = name.title()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


# =========================================================
# DOCTOR PROFILE
# =========================================================

class DoctorProfile(BaseModel):
    doctor_profile_id = models.AutoField(primary_key=True)
    doctor_code = models.CharField(max_length=20, unique=True, blank=True)

    staff = models.OneToOneField(
        "administration.Staff",
        on_delete=models.PROTECT,
        related_name="doctor_profile"
    )

    specialization = models.ForeignKey(
        "administration.Specialization",
        on_delete=models.PROTECT,
        related_name="doctors"
    )

    consultation_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(100),
            MaxValueValidator(5000)
        ]
    )

    # ⚠ Requirement preserved: exactly 25 patients per day
    max_patient_per_day = models.PositiveIntegerField(
        default=25,
        validators=[
            MinValueValidator(25),
            MaxValueValidator(25)
        ]
    )

    is_active = models.BooleanField(default=True)

    duty_status = models.CharField(
        max_length=20,
        choices=DoctorDutyStatus.choices,
        default=DoctorDutyStatus.AVAILABLE,
        db_index=True,
        help_text="Current duty status of the doctor"
    )

    @property
    def doctor_name(self):
        return self.staff.user.get_full_name()


    @property
    def specialization_name(self):
        return self.specialization.name

    @property
    def is_bookable(self):
        """Doctor can accept appointments only when AVAILABLE."""
        return self.duty_status == DoctorDutyStatus.AVAILABLE
    
    class Meta:
        db_table = "doctor_profiles"
        ordering = ["doctor_code"]

    def clean(self):
        if self.staff.is_deleted:
            raise ValidationError({"staff":"Cannot assign Doctor profile to deleted staff."})

        if self.is_deleted:
            raise ValidationError({"doctor_profile_id":"Cannot modify deleted doctor profile."})
        
        if not self.staff.is_active:
            raise ValidationError({"staff":"Staff must be active to assign Doctor profile."})

        if not getattr(self.staff.user, "groups", None) or not self.staff.user.groups.filter(name="Doctor").exists():
            raise ValidationError({"staff":"Staff must have Doctor role to assign Doctor profile."})

        if self.specialization.is_deleted:
            raise ValidationError({"specialization":"Cannot assign deleted specialization."})

        if self.pk:
            original = DoctorProfile.objects.filter(pk=self.pk).first()
            if original and original.staff_id != self.staff_id:
                raise ValidationError({"staff":"Changing assigned staff is not allowed."})

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        with transaction.atomic():
            self.full_clean()
            super().save(*args, **kwargs)

            if is_new and not self.doctor_code:
                self.doctor_code = f"DR{str(self.doctor_profile_id).zfill(3)}"
                super().save(update_fields=["doctor_code"])

    # def delete(self, *args, **kwargs):
    #     if self.is_deleted:
    #         return

    #     with transaction.atomic():
    #         # ✅ Soft delete doctor
    #         self.is_deleted = True
    #         self.is_active = False
    #         self.version += 1
    #         self.save(update_fields=["is_deleted", "is_active", "version", "updated_at"])

    #         # 🔥 CASCADE DELETE SCHEDULES
    #         DoctorSchedule.objects.filter(
    #             doctor=self,
    #             is_deleted=False
    #         ).update(
    #             is_deleted=True,
    #             is_active=False,
    #             version=models.F("version") + 1
    #         )

    def __str__(self):
        name = self.staff.user.get_full_name()
        if not name:
            name = self.staff.user.username
        return f"{self.doctor_code} - {name}"
# =========================================================
# DOCTOR SCHEDULE
# =========================================================

class DayOfWeekChoices(models.TextChoices):
    MONDAY = "MONDAY", "Monday"
    TUESDAY = "TUESDAY", "Tuesday"
    WEDNESDAY = "WEDNESDAY", "Wednesday"
    THURSDAY = "THURSDAY", "Thursday"
    FRIDAY = "FRIDAY", "Friday"
    SATURDAY = "SATURDAY", "Saturday"
    SUNDAY = "SUNDAY", "Sunday"


class DoctorSchedule(BaseModel):
    schedule_id = models.AutoField(primary_key=True)

    doctor = models.ForeignKey(
        "administration.DoctorProfile",
        on_delete=models.PROTECT,
        related_name="schedules"
    )

    day_of_week = models.CharField(max_length=10, choices=DayOfWeekChoices.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "doctor_schedule"
        ordering = ["doctor", "day_of_week", "start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["doctor", "day_of_week", "start_time", "end_time"],
                condition=Q(is_deleted=False),
                name="%(app_label)s_%(class)s_unique_active_schedule"
            )
        ]

    def clean(self):
        if self.doctor.is_deleted or not self.doctor.is_active:
            raise ValidationError({"doctor":"Cannot assign schedule to inactive/deleted doctor."})
        
        if not self.doctor.staff.is_active:
            raise ValidationError({"doctor":"Cannot assign schedule because staff is inactive."})
        
        if self.is_deleted:
            raise ValidationError({"schedule_id":"Cannot modify deleted schedule."})

        if self.start_time >= self.end_time:
            raise ValidationError({"end_time":"Start time must be before end time."})

        overlapping = DoctorSchedule.objects.filter(
            doctor=self.doctor,
            day_of_week=self.day_of_week,
            is_deleted=False,
            is_active=True
        ).exclude(pk=self.pk)

        for schedule in overlapping:
            if (
                self.start_time < schedule.end_time and
                self.end_time > schedule.start_time
            ):
                raise ValidationError({"start_time": "Schedule overlaps with existing active schedule."})

    def save(self, *args, **kwargs):
        with transaction.atomic():
            self.full_clean()
            
            overlapping = DoctorSchedule.objects.select_for_update().filter(
                doctor=self.doctor,
                day_of_week=self.day_of_week,
                is_deleted=False,
                is_active=True
            ).exclude(pk=self.pk)

            for schedule in overlapping:
                if (
                    self.start_time < schedule.end_time and
                    self.end_time > schedule.start_time
                ):
                    raise ValidationError({"start_time": "Schedule overlaps with existing active schedule."})

            super().save(*args, **kwargs)
            
    def __str__(self):
        return f"{self.doctor.doctor_code} - {self.day_of_week}"
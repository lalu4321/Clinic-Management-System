from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
import pytz
import re

from reception.models import (
    Patient,
    Appointment,
    ConsultationBill,

)
from reception.slot_validator import validate_appointment_slot, SlotValidationError


# IST timezone
IST = pytz.timezone('Asia/Kolkata')


# ---------------------------------------------------------------------------
# Shared strict validators (mirror frontend validation.js rules exactly)
# ---------------------------------------------------------------------------

def _validate_indian_phone(value, field_label="Phone"):
    """10-digit Indian mobile: starts 6-9, ≥4 unique digits, no all-same, no sequential."""
    raw = (value or "").strip()
    digits = re.sub(r"^\+91", "", raw)
    if not digits:
        raise serializers.ValidationError(f"{field_label} is required.")
    if not re.fullmatch(r"\d{10}", digits):
        raise serializers.ValidationError(
            f"{field_label} must be exactly 10 digits (optional +91 prefix)."
        )
    if not re.match(r"^[6-9]", digits):
        raise serializers.ValidationError(
            f"{field_label} must start with 6, 7, 8, or 9."
        )
    if len(set(digits)) == 1:
        raise serializers.ValidationError(
            f"{field_label} cannot be all identical digits."
        )
    # Sequential ascending pattern (e.g. 6789012345)
    ascending = "".join(str((int(digits[0]) + i) % 10) for i in range(10))
    if digits == ascending:
        raise serializers.ValidationError(
            f"{field_label} cannot be a sequential pattern."
        )
    if len(set(digits)) < 4:
        raise serializers.ValidationError(
            f"{field_label} must contain at least 4 different digits."
        )
    return digits  # normalised (without +91)


def _validate_human_name(value, field_label="Name"):
    """Letters only, 3–50 chars, max 2 consecutive identical characters."""
    v = (value or "").strip()
    if not v:
        raise serializers.ValidationError(f"{field_label} is required.")
    if len(v) < 3:
        raise serializers.ValidationError(f"{field_label} must be at least 3 characters.")
    if len(v) > 50:
        raise serializers.ValidationError(f"{field_label} must not exceed 50 characters.")
    if not re.fullmatch(r"[A-Za-z]+", v):
        raise serializers.ValidationError(f"{field_label} must contain letters only (no numbers or symbols).")
    if re.search(r"(.)\1{2,}", v, re.IGNORECASE):
        raise serializers.ValidationError(
            f"{field_label} cannot have more than 2 consecutive identical characters."
        )
    return v


def _validate_strict_email(value):
    """Require proper TLD, no fake patterns like abc@abc."""
    if not value:
        return value
    v = value.strip().lower()
    if not re.fullmatch(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", v):
        raise serializers.ValidationError(
            "Enter a valid email address with a proper domain (e.g. user@example.com)."
        )
    local = v.split("@")[0]
    if ".." in local:
        raise serializers.ValidationError("Email local part cannot contain consecutive dots.")
    domain_label = v.split("@")[1].split(".")[0]
    if local == domain_label and len(local) <= 4:
        raise serializers.ValidationError(
            "Email appears to be a test/fake address. Please use a real email."
        )
    return v


def _validate_address(value):
    """
    5–100 chars, letters/numbers/spaces and . , - ( )',
    must contain ≥1 letter, max 3 consecutive identical chars.
    """
    v = " ".join((value or "").split())  # collapse whitespace + trim
    if not v:
        raise serializers.ValidationError("Address is required.")
    if len(v) < 5:
        raise serializers.ValidationError("Address must be at least 5 characters.")
    if len(v) > 100:
        raise serializers.ValidationError("Address must not exceed 100 characters.")
    if not re.fullmatch(r"[A-Za-z0-9\s.,\-()']+", v):
        raise serializers.ValidationError(
            "Address may only contain letters, numbers, spaces, and . , - ( ) '"
        )
    if not re.search(r"[A-Za-z]", v):
        raise serializers.ValidationError("Address must contain at least one letter.")
    if re.search(r"(.)\1{3,}", v):
        raise serializers.ValidationError(
            "Address cannot have more than 3 consecutive identical characters."
        )
    return v


class PatientSerializer(serializers.ModelSerializer):

    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = (
            "patient_id",
            "patient_code",
            "created_at",
            "updated_at",
            "version"
        )

    # ------------------------------------------------------------------
    # Field-level validators (surface as individual field errors in UI)
    # ------------------------------------------------------------------

    def validate_first_name(self, value):
        return _validate_human_name(value, "First name")

    def validate_last_name(self, value):
        return _validate_human_name(value, "Last name")

    def validate_phone(self, value):
        digits = _validate_indian_phone(value, "Phone")
        return digits  # store normalised 10-digit value

    def validate_emergency_contact_number(self, value):
        digits = _validate_indian_phone(value, "Emergency contact")
        return digits

    def validate_email(self, value):
        return _validate_strict_email(value)

    def validate_address(self, value):
        return _validate_address(value)

    def validate(self, attrs):
        phone = attrs.get("phone")
        emergency = attrs.get("emergency_contact_number")

        if phone and emergency and phone == emergency:
            raise serializers.ValidationError({
                "emergency_contact_number": "Emergency contact number cannot be the same as patient phone."
            })
        return attrs

    def update(self, instance, validated_data):
        if instance.is_deleted:
            raise serializers.ValidationError("Cannot modify deleted patient.")
        return super().update(instance, validated_data)
    
    
class AppointmentSerializer(serializers.ModelSerializer):

    version = serializers.IntegerField(required=False)
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}".strip() if obj.patient else None

    def get_doctor_name(self, obj):
        if obj.doctor and obj.doctor.staff and obj.doctor.staff.user:
            u = obj.doctor.staff.user
            return f"{u.first_name} {u.last_name}".strip()
        return None

    class Meta:
        model = Appointment
        fields = "__all__"
        read_only_fields = (
            "appointment_id",
            "appointment_code",
            "token_number",
            "completed_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance
        doctor = attrs.get('doctor')
        appointment_date = attrs.get('appointment_date')
        appointment_time = attrs.get('appointment_time')

        if instance:
            # Immutable fields for updates
            for field in ["patient", "doctor", "appointment_date", "appointment_time"]:
                if field in attrs and getattr(instance, field) != attrs[field]:
                    raise serializers.ValidationError(f"{field} cannot be modified.")
        else:
            # New appointment - comprehensive slot validation
            if doctor and appointment_date and appointment_time:
                try:
                    # Get doctor ID
                    doctor_id = doctor.doctor_profile_id if hasattr(doctor, 'doctor_profile_id') else doctor

                    # Get patient ID for cross-doctor conflict check
                    patient = attrs.get('patient')
                    patient_id = patient.patient_id if hasattr(patient, 'patient_id') else patient

                    # Validate slot (includes past time, working hours, patient conflict,
                    # and doctor double-booking)
                    validate_appointment_slot(
                        doctor_id=doctor_id,
                        appointment_date=appointment_date,
                        appointment_time=appointment_time,
                        patient_id=patient_id,
                    )
                except SlotValidationError as e:
                    raise serializers.ValidationError({e.field: e.message})

        return attrs

    def create(self, validated_data):
        # Use atomic transaction to prevent race conditions
        from django.db import IntegrityError

        try:
            with transaction.atomic():
                return super().create(validated_data)
        except IntegrityError as e:
            error_str = str(e).lower()
            if 'unique_timeslot_per_patient' in error_str:
                raise serializers.ValidationError({
                    "appointment_time": "Patient already has an appointment in this time slot."
                })
            if 'unique_timeslot_per_doctor' in error_str or 'unique' in error_str:
                raise serializers.ValidationError({
                    "appointment_time": "This time slot is already booked. Please select a different time."
                })
            raise

    def update(self, instance, validated_data):

        if instance.is_deleted:
            raise serializers.ValidationError("Cannot modify deleted appointment.")

        incoming_version = validated_data.pop("version", None)

        if incoming_version is None:
            raise serializers.ValidationError("Version required.")

        if instance.version != incoming_version:
            raise serializers.ValidationError(
                "Record modified by another transaction."
            )

        return super().update(instance, validated_data)
        
        
        
class AppointmentStatusUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = Appointment
        fields = ("status", "version")

    def validate(self, attrs):
        if attrs.get("version") is None:
            raise serializers.ValidationError("Version required.")
        return attrs

    def update(self, instance, validated_data):

        if instance.is_deleted:
            raise serializers.ValidationError("Cannot modify deleted appointment.")

        if instance.version != validated_data["version"]:
            raise serializers.ValidationError(
                "Record modified by another transaction."
            )

        instance.status = validated_data["status"]
        instance.save()  # model handles version

        return instance
        
    
    
class ConsultationBillSerializer(serializers.ModelSerializer):

    version = serializers.IntegerField(required=True)
    patient_name = serializers.SerializerMethodField()
    patient_code = serializers.SerializerMethodField()
    appointment_code = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    doctor_code = serializers.SerializerMethodField()
    specialization = serializers.SerializerMethodField()
    paid_at_ist = serializers.SerializerMethodField()

    def get_patient_name(self, obj):
        p = obj.appointment.patient if obj.appointment else None
        return f"{p.first_name} {p.last_name}".strip() if p else None

    def get_patient_code(self, obj):
        p = obj.appointment.patient if obj.appointment else None
        return p.patient_code if p else None

    def get_appointment_code(self, obj):
        return obj.appointment.appointment_code if obj.appointment else None

    def get_doctor_name(self, obj):
        try:
            u = obj.appointment.doctor.staff.user
            name = f"{u.first_name} {u.last_name}".strip()
            return name or u.username
        except Exception:
            return None

    def get_doctor_code(self, obj):
        try:
            return obj.appointment.doctor.doctor_code
        except Exception:
            return None

    def get_specialization(self, obj):
        try:
            return obj.appointment.doctor.specialization.name
        except Exception:
            return None

    def get_paid_at_ist(self, obj):
        """Return paid_at formatted in IST."""
        if not obj.paid_at:
            return None
        paid_ist = obj.paid_at.astimezone(IST)
        return {
            "date": paid_ist.strftime("%d %b %Y"),
            "time": paid_ist.strftime("%I:%M %p"),
            "iso": paid_ist.isoformat(),
        }

    class Meta:
        model = ConsultationBill
        fields = "__all__"
        read_only_fields = (
            "consultation_bill_id",
            "bill_code",
            "total_amount",
            "paid_at",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        instance = self.instance

        if instance:
            if attrs.get("version") is None:
                raise serializers.ValidationError("Version required.")

            if attrs.get("version") <= 0:
                raise serializers.ValidationError("Invalid version.")

        return attrs

    def create(self, validated_data):
        return super().create(validated_data)

    def update(self, instance, validated_data):

        incoming_version = validated_data.pop("version", None)

        if incoming_version is None:
            raise serializers.ValidationError("Version required.")

        if instance.version != incoming_version:
            raise serializers.ValidationError(
                "Record modified by another transaction."
            )

        instance.status = validated_data.get("status", instance.status)

        instance.save()  # handles version + paid_at

        return instance
                
        
class BillStatusUpdateSerializer(serializers.ModelSerializer):

    class Meta:
        model = ConsultationBill
        fields = ("status", "version")

    def validate(self, attrs):
        if attrs.get("version") is None:
            raise serializers.ValidationError("Version required.")
        return attrs

    def update(self, instance, validated_data):

        if instance.is_deleted:
            raise serializers.ValidationError("Cannot modify deleted bill.")

        if instance.version != validated_data["version"]:
            raise serializers.ValidationError(
                "Record modified by another transaction."
            )

        instance.status = validated_data["status"]
        instance.save()

        return instance
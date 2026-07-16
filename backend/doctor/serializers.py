import re
from rest_framework import serializers
from reception.models import Appointment
from reception.models import AppointmentStatus
from .models import Prescription, PrescriptionItem, LabTestRequest, PrescriptionStatus
from django.db import transaction
from rest_framework.exceptions import ValidationError
from .models import LabRequestStatus

# =========================================================
# VALID FREQUENCY CHOICES
# =========================================================

VALID_FREQUENCIES = ["1-0-1", "1-1-1", "1-1-0", "0-1-1", "1-0-0", "0-1-0", "0-0-1"]

# =========================================================
# CLINICAL TEXT VALIDATOR (symptoms & diagnosis)
# =========================================================

_CLINICAL_PATTERN = re.compile(r'^[A-Za-z\s.,()]+$')


def _validate_clinical_text(value, field_name, min_len=3, max_len=100):
    """
    Validate symptoms / diagnosis text.
    - Min 3, max 100 chars
    - Only letters, spaces, '.', ',', '(', ')'
    - Must contain at least one letter
    - No run of 4+ identical consecutive characters
    """
    value = (value or "").strip()

    if not value:
        raise serializers.ValidationError(f"{field_name} is required.")

    if len(value) < min_len:
        raise serializers.ValidationError(
            f"{field_name} must be at least {min_len} characters."
        )

    if len(value) > max_len:
        raise serializers.ValidationError(
            f"{field_name} must not exceed {max_len} characters."
        )

    if not _CLINICAL_PATTERN.match(value):
        raise serializers.ValidationError(
            f"{field_name} may only contain letters, spaces, '.', ',', '(', ')'."
        )

    if not re.search(r'[A-Za-z]', value):
        raise serializers.ValidationError(
            f"{field_name} must contain at least one letter."
        )

    if re.search(r'(.)\1{3,}', value):
        raise serializers.ValidationError(
            f"{field_name} cannot contain the same character repeated 4 or more times consecutively."
        )

    return value


# =========================================================
# DOCTOR APPOINTMENT SERIALIZER
# =========================================================

class DoctorAppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    has_prescription = serializers.SerializerMethodField()
    # Populated by the queryset annotation in DoctorAppointmentViewSet.
    # True when the appointment's scheduled time has already passed today.
    is_missed = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Appointment
        fields = [
            "appointment_id",
            "appointment_code",
            "appointment_date",
            "appointment_time",
            "token_number",
            "status",
            "patient_name",
            "has_prescription",
            "is_missed",
        ]

    def get_has_prescription(self, obj):
        try:
            return obj.prescription is not None and not obj.prescription.is_deleted
        except Exception:
            return False


# =========================================================
# PRESCRIPTION ITEM SERIALIZER
# =========================================================

class PrescriptionItemSerializer(serializers.ModelSerializer):
    prescription = serializers.PrimaryKeyRelatedField(
        queryset=Prescription.objects.all(),
        required=False
    )
    medicine_name = serializers.CharField(source="medicine.med_name", read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = [
            "prescription_item_id",
            "prescription",
            "medicine",
            "medicine_name",
            "dosage",
            "frequency",
            "quantity",
            "created_at"
        ]
        read_only_fields = ["prescription_item_id", "medicine_name", "created_at"]

    def validate_dosage(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Dosage is required.")
        if len(value) > 20:
            raise serializers.ValidationError("Dosage must not exceed 20 characters.")
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        prescription = attrs.get("prescription") or getattr(instance, "prescription", None)

        if not prescription:
            raise serializers.ValidationError("Prescription must be provided.")

        # Check appointment exists
        appointment = getattr(prescription, "appointment", None)
        if not appointment:
            raise serializers.ValidationError("Prescription has no appointment linked.")

        # Check doctor ownership
        doctor_user = getattr(getattr(appointment, "doctor", None), "staff", None)
        doctor_user = getattr(doctor_user, "user", None)
        if not doctor_user:
            raise serializers.ValidationError("Prescription has no doctor linked.")

        request = self.context.get("request")
        if request and doctor_user != request.user:
            raise serializers.ValidationError("Cannot modify another doctor's prescription.")

        if prescription.status == PrescriptionStatus.COMPLETED:
            raise serializers.ValidationError("Cannot modify items of a completed prescription.")

        # ── Dosage must be one of the pharmacist-configured values ──────────
        # A prescription item is ONLY accepted when the pharmacist has already
        # defined at least one dosage for the medicine AND the submitted value
        # is among those options.  No free-text overrides are allowed.
        dosage  = attrs.get("dosage")
        medicine_for_dosage = attrs.get("medicine") or getattr(instance, "medicine", None)
        if medicine_for_dosage:
            from pharmacist.models import MedicineDosage
            allowed = list(
                MedicineDosage.objects.filter(
                    medicine=medicine_for_dosage,
                    is_deleted=False,
                ).values_list("dosage_value", flat=True)
            )
            if not allowed:
                raise serializers.ValidationError(
                    {
                        "dosage": (
                            f"No dosages are configured for "
                            f"{medicine_for_dosage.med_name}. "
                            f"Ask the pharmacist to add dosage options first."
                        )
                    }
                )
            if dosage and dosage not in allowed:
                raise serializers.ValidationError(
                    {
                        "dosage": (
                            f"'{dosage}' is not a valid dosage for "
                            f"{medicine_for_dosage.med_name}. "
                            f"Allowed: {', '.join(sorted(allowed))}."
                        )
                    }
                )

        # ── Frequency must be one of the valid choices ──
        frequency = attrs.get("frequency")
        if frequency is not None and frequency not in VALID_FREQUENCIES:
            raise serializers.ValidationError(
                {"frequency": f"Invalid frequency. Allowed values: {', '.join(VALID_FREQUENCIES)}."}
            )

        # ── Quantity: 1–100 (auto-calculated from frequency × duration) ──
        quantity = attrs.get("quantity")
        if quantity is not None:
            if quantity < 1:
                raise serializers.ValidationError(
                    {"quantity": "Quantity must be at least 1."}
                )
            if quantity > 100:
                raise serializers.ValidationError(
                    {"quantity": "Quantity must not exceed 100."}
                )

        # ── Real-time stock availability check ──────────────────────────────
        # Prevents over-prescription when multiple doctors prescribe the same
        # medicine. Net available = total stock − quantity reserved by existing
        # DRAFT/ACTIVE prescriptions not yet dispensed.
        medicine = attrs.get("medicine") or getattr(instance, "medicine", None)
        if medicine and quantity is not None:
            from django.db.models import Sum
            from django.utils import timezone as tz
            from pharmacist.models import MedicineInventory, InventoryStatus

            total_available = (
                MedicineInventory.objects.filter(
                    medicine=medicine,
                    status=InventoryStatus.AVAILABLE,
                    expiry_date__gte=tz.now().date(),
                    is_deleted=False,
                ).aggregate(total=Sum("quantity_available"))["total"] or 0
            )

            # Reserved = quantities in DRAFT/ACTIVE prescriptions not yet
            # dispensed (no bill items exist for those prescriptions).
            reserved_qs = PrescriptionItem.objects.filter(
                medicine=medicine,
                is_deleted=False,
                prescription__status__in=[
                    PrescriptionStatus.DRAFT,
                    PrescriptionStatus.ACTIVE,
                ],
                prescription__is_deleted=False,
            ).exclude(
                prescription__pharmacy_bill__items__is_deleted=False,
                prescription__pharmacy_bill__is_deleted=False,
            )

            if instance:
                # Updating an existing item: subtract its old quantity so we
                # compare against the replacement, not old + new.
                reserved_qs = reserved_qs.exclude(pk=instance.pk)

            reserved = reserved_qs.aggregate(
                total=Sum("quantity")
            )["total"] or 0

            net_available = max(0, total_available - reserved)

            if net_available < quantity:
                raise serializers.ValidationError(
                    {
                        "quantity": (
                            f"Insufficient stock available for {medicine.med_name}. "
                            f"Only {net_available} unit(s) available after accounting "
                            f"for existing prescriptions."
                        )
                    }
                )

        return attrs

    def update(self, instance, validated_data):
        # Only allow updating dosage, frequency, quantity
        allowed_fields = ["dosage", "frequency", "quantity"]
        for field in allowed_fields:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance


# =========================================================
# PRESCRIPTION SERIALIZER
# =========================================================

class PrescriptionSerializer(serializers.ModelSerializer):

    items = PrescriptionItemSerializer(many=True, read_only=True)
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = [
            "prescription_id",
            "prescription_code",
            "appointment",
            "symptoms",
            "diagnosis",
            "status",
            "created_at",
            "items",
            "patient_name",
            "doctor_name",
        ]
        read_only_fields = ["prescription_id", "prescription_code", "created_at"]

    def get_patient_name(self, obj):
        try:
            p = obj.appointment.patient
            return f"{p.first_name} {p.last_name}".strip()
        except AttributeError:
            return None

    def get_doctor_name(self, obj):
        try:
            u = obj.appointment.doctor.staff.user
            return f"{u.first_name} {u.last_name}".strip()
        except AttributeError:
            return None

    # ── Symptoms validation ──────────────────────────────
    def validate_symptoms(self, value):
        return _validate_clinical_text(value, "Symptoms")

    # ── Diagnosis validation ─────────────────────────────
    def validate_diagnosis(self, value):
        return _validate_clinical_text(value, "Diagnosis")

    def validate_appointment(self, value):
        if value.status not in [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.COMPLETED
        ]:
            raise serializers.ValidationError(
                "Prescription allowed only for appointments in progress or completed."
            )
        return value

    def update(self, instance, validated_data):
        with transaction.atomic():
            if instance.status == PrescriptionStatus.COMPLETED:
                raise serializers.ValidationError(
                    "Cannot update a completed prescription."
                )

            if "appointment" in validated_data and \
                    validated_data["appointment"] != instance.appointment:
                raise serializers.ValidationError(
                    {"appointment": "Appointment cannot be changed."}
                )

            ALLOWED_TRANSITIONS = {
                PrescriptionStatus.DRAFT: [PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED],
                PrescriptionStatus.ACTIVE: [PrescriptionStatus.COMPLETED, PrescriptionStatus.CANCELLED],
                PrescriptionStatus.COMPLETED: [],
                PrescriptionStatus.CANCELLED: [],
            }

            new_status = validated_data.get("status")
            if new_status is not None:
                allowed_next = ALLOWED_TRANSITIONS.get(instance.status)
                if allowed_next is None:
                    raise serializers.ValidationError(
                        f"Invalid current status: {instance.status}"
                    )
                if new_status not in allowed_next:
                    raise serializers.ValidationError(
                        f"Invalid status transition from {instance.status} to {new_status}"
                    )

            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            instance.save()
            return instance

    def validate(self, attrs):
        appointment = attrs.get("appointment")
        if appointment:
            qs = Prescription.objects.filter(
                appointment=appointment,
                is_deleted=False
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Prescription already exists for this appointment."
                )
        return attrs


# =========================================================
# LAB TEST REQUEST SERIALIZER
# =========================================================

class LabTestRequestSerializer(serializers.ModelSerializer):

    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    lab_test_name = serializers.SerializerMethodField()
    appointment_code = serializers.SerializerMethodField()

    class Meta:
        model = LabTestRequest
        fields = [
            "lab_test_request_id",
            "appointment",
            "appointment_code",
            "lab_test",
            "lab_test_name",
            "notes",
            "status",
            "is_deleted",
            "created_at",
            "patient_name",
            "doctor_name",
        ]
        read_only_fields = ["lab_test_request_id", "appointment_code", "created_at", "is_deleted"]

    def get_patient_name(self, obj):
        try:
            p = obj.appointment.patient
            return f"{p.first_name} {p.last_name}".strip()
        except AttributeError:
            return None

    def get_doctor_name(self, obj):
        try:
            u = obj.appointment.doctor.staff.user
            return f"{u.first_name} {u.last_name}".strip()
        except AttributeError:
            return None

    def get_lab_test_name(self, obj):
        try:
            return obj.lab_test.test_name
        except AttributeError:
            return None

    def get_appointment_code(self, obj):
        try:
            return obj.appointment.appointment_code
        except AttributeError:
            return None

    # ── Notes: optional, 3–50 chars ─────────────────────
    def validate_notes(self, value):
        value = (value or "").strip()
        if value:
            if len(value) < 3:
                raise serializers.ValidationError(
                    "Notes must contain at least 3 characters."
                )
            if len(value) > 50:
                raise serializers.ValidationError(
                    "Notes must not exceed 50 characters."
                )
        return value

    def validate_appointment(self, value):
        if value.status not in [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.COMPLETED,
        ]:
            raise serializers.ValidationError(
                "Lab request allowed only for active or completed appointments."
            )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None

        appointment = attrs.get("appointment") or getattr(
            self.instance, "appointment", None
        )

        if appointment:
            try:
                appt_doctor_user = appointment.doctor.staff.user
            except AttributeError:
                raise serializers.ValidationError(
                    "Appointment has no doctor linked."
                )
        else:
            appt_doctor_user = None

        is_lab_tech = (
            user.groups.filter(name__iexact="LabTechnician").exists()
            if user else False
        )
        is_doctor = (
            user.groups.filter(name__iexact="Doctor").exists()
            if user else False
        )

        if is_doctor and appt_doctor_user and appt_doctor_user != user:
            raise serializers.ValidationError(
                "You cannot create or update lab requests for another doctor's appointment."
            )

        if is_lab_tech:
            allowed_fields = {"status"}
            disallowed = set(attrs.keys()) - allowed_fields
            if disallowed:
                raise serializers.ValidationError(
                    f"Lab technicians can only update: {allowed_fields}."
                )
            if attrs.get("status") != LabRequestStatus.COMPLETED:
                raise serializers.ValidationError(
                    "Lab technicians can only mark a request as COMPLETED."
                )

        return attrs

    def update(self, instance, validated_data):
        with transaction.atomic():
            new_appointment = validated_data.get("appointment")
            if new_appointment and new_appointment.appointment_id != instance.appointment.appointment_id:
                raise serializers.ValidationError(
                    {"appointment": "Appointment cannot be changed."}
                )

            new_lab_test = validated_data.get("lab_test")
            if new_lab_test and new_lab_test.lab_test_id != instance.lab_test.lab_test_id:
                raise serializers.ValidationError(
                    {"lab_test": "Lab test cannot be changed."}
                )

            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            instance.save()
            return instance


# =========================================================
# PATIENT RECORD SERIALIZER
# =========================================================

class PatientRecordSerializer(serializers.Serializer):

    appointment_id = serializers.IntegerField(read_only=True)
    appointment_code = serializers.CharField(max_length=20, read_only=True)
    patient_name = serializers.CharField(max_length=150, read_only=True)

    diagnosis = serializers.CharField(required=False, allow_blank=True)
    symptoms = serializers.CharField(required=False, allow_blank=True)

    medicines = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    lab_tests = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    lab_results = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )

    def validate_symptoms(self, value):
        return _validate_clinical_text(value, "Symptoms") if value else value

    def validate_diagnosis(self, value):
        return _validate_clinical_text(value, "Diagnosis") if value else value

    def validate_medicines(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Medicines must be a list.")

        required_fields = ["medicine", "dosage", "frequency", "quantity"]
        for med in value:
            if not isinstance(med, dict):
                raise serializers.ValidationError("Each medicine must be an object.")
            for field in required_fields:
                if field not in med or med[field] in [None, "", []]:
                    raise serializers.ValidationError(f"{field} is required in medicine.")
            # Frequency validation
            freq = med.get("frequency")
            if freq and freq not in VALID_FREQUENCIES:
                raise serializers.ValidationError(
                    f"Invalid frequency '{freq}'. Allowed: {', '.join(VALID_FREQUENCIES)}."
                )
            # Quantity validation
            qty = med.get("quantity")
            if qty is not None:
                try:
                    qty_int = int(qty)
                except (TypeError, ValueError):
                    raise serializers.ValidationError("Quantity must be a number.")
                if qty_int < 1 or qty_int > 10:
                    raise serializers.ValidationError("Quantity must be between 1 and 10.")

        return value

    def validate_lab_tests(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Lab tests must be a list.")
        for test in value:
            if not str(test).strip():
                raise serializers.ValidationError("Lab test name cannot be empty.")
        return value

    def validate_lab_results(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Lab results must be a list.")
        for result in value:
            if not isinstance(result, dict):
                raise serializers.ValidationError("Each lab result must be an object.")
            if "test" not in result or not result["test"]:
                raise serializers.ValidationError("Test name is required.")
            if "result" not in result or not result["result"]:
                raise serializers.ValidationError("Result value is required.")
        return value

    def validate(self, data):
        if not data.get("medicines") and not data.get("lab_tests") and not data.get("diagnosis"):
            raise serializers.ValidationError(
                "At least diagnosis, medicine, or lab test must be provided."
            )
        return data

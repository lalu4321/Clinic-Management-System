import re
from decimal import Decimal
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from doctor.models import LabRequestStatus, LabTestRequest

from .models import (
    LabTestCatalog,
    LabTestParameter,
    LabTestResult,
    LabBill,
    LabBillItem,
    LabReport,
    LabTestStatus
)


# =========================================================
# HELPERS (mirror backend model validation for early errors)
# =========================================================

def _no_special_chars(value, field):
    if re.search(r'[$#%&*@!^<>=+|\\\/;:\"\'\`~]', value):
        raise serializers.ValidationError("Enter a valid value")


def _no_consecutive(value, field, max_run=3):
    if re.search(r'(.)\1{' + str(max_run) + r',}', value):
        raise serializers.ValidationError(
            "Same character cannot be repeated more than 3 times"
        )


# =========================================================
# ENTERPRISE BASE SERIALIZER
# =========================================================

class EnterpriseModelSerializer(serializers.ModelSerializer):
    """
    Converts Django ValidationErrors and DB IntegrityErrors into HTTP 400.
    """

    def create(self, validated_data):
        try:
            with transaction.atomic():
                return super().create(validated_data)
        except DjangoValidationError as e:
            if hasattr(e, "message_dict"):
                raise serializers.ValidationError(e.message_dict)
            raise serializers.ValidationError({"error": e.messages})
        except IntegrityError:
            raise serializers.ValidationError(
                {"database_error": "Database constraint violated."}
            )

    def update(self, instance, validated_data):
        try:
            with transaction.atomic():
                return super().update(instance, validated_data)
        except DjangoValidationError as e:
            if hasattr(e, "message_dict"):
                raise serializers.ValidationError(e.message_dict)
            raise serializers.ValidationError({"error": e.messages})
        except IntegrityError:
            raise serializers.ValidationError(
                {"database_error": "Database constraint violated."}
            )


# =========================================================
# LAB TEST PARAMETER SERIALIZER
# =========================================================

class LabTestParameterSerializer(EnterpriseModelSerializer):

    class Meta:
        model = LabTestParameter
        fields = [
            "parameter_id",
            "lab_test",
            "parameter_name",
            "reference_min",
            "reference_max",
            "unit",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["parameter_id", "created_at", "updated_at"]

    def validate_parameter_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Parameter name cannot be empty.")
        if len(value) < 3:
            raise serializers.ValidationError(
                "Parameter name must be at least 3 characters."
            )
        if len(value) > 15:
            raise serializers.ValidationError(
                "Parameter name cannot exceed 15 characters."
            )
        if not re.match(r'^[A-Za-z]+$', value):
            raise serializers.ValidationError(
                "Parameter name can only contain letters. No spaces or special characters allowed."
            )
        return value

    def validate_reference_min(self, value):
        if value is None:
            raise serializers.ValidationError("Reference minimum value is required.")
        if value < Decimal("1"):
            raise serializers.ValidationError(
                "Reference minimum value must be at least 1."
            )
        return value

    def validate_reference_max(self, value):
        if value is None:
            raise serializers.ValidationError("Reference maximum value is required.")
        if value > Decimal("500"):
            raise serializers.ValidationError(
                "Reference maximum value cannot exceed 500."
            )
        return value

    def validate(self, attrs):
        ref_min = attrs.get("reference_min") or (
            self.instance.reference_min if self.instance else None
        )
        ref_max = attrs.get("reference_max") or (
            self.instance.reference_max if self.instance else None
        )
        if ref_min is not None and ref_max is not None:
            if ref_min >= ref_max:
                raise serializers.ValidationError(
                    {"reference_min": "Reference minimum must be less than maximum."}
                )

        unit = attrs.get("unit", "")
        if not unit or not str(unit).strip():
            raise serializers.ValidationError({"unit": "Unit is required."})

        return attrs


# =========================================================
# LAB TEST CATALOG SERIALIZER
# =========================================================

class LabTestCatalogSerializer(EnterpriseModelSerializer):

    # Parameters nested read-only for catalog view
    parameters = LabTestParameterSerializer(many=True, read_only=True)

    class Meta:
        model = LabTestCatalog
        fields = [
            "lab_test_id",
            "lab_test_code",
            "test_name",
            "description",
            "test_charge",
            "status",
            "parameters",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "lab_test_id",
            "lab_test_code",
            "parameters",
            "created_at",
            "updated_at",
        ]

    def validate_test_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Test name cannot be empty.")
        if len(value) < 3:
            raise serializers.ValidationError(
                "Test name must be at least 3 characters."
            )
        if len(value) > 20:
            raise serializers.ValidationError(
                "Test name cannot exceed 20 characters."
            )
        if not re.match(r'^[A-Za-z ]+$', value):
            raise serializers.ValidationError(
                "Test name can only contain letters and spaces. No special characters allowed."
            )
        _no_consecutive(value, "Test name")
        return value

    def validate_description(self, value):
        if not value:
            return value
        value = value.strip()
        if not value:
            return None
        if len(value) > 100:
            raise serializers.ValidationError(
                "Description cannot exceed 100 characters."
            )
        _no_special_chars(value, "Description")
        _no_consecutive(value, "Description")
        return value

    def validate_test_charge(self, value):
        if value is None:
            raise serializers.ValidationError("Test charge is required.")
        if value <= 0:
            raise serializers.ValidationError("Enter a valid non-zero value.")
        if value < Decimal("50"):
            raise serializers.ValidationError("Test charge must be at least ₹50.")
        if value > Decimal("5000"):
            raise serializers.ValidationError("Test charge cannot exceed ₹5000.")
        return value

    def validate_status(self, value):
        if (
            self.instance and
            self.instance.status == LabTestStatus.INACTIVE and
            value == LabTestStatus.ACTIVE
        ):
            raise serializers.ValidationError(
                "Inactive tests cannot be reactivated through status field. "
                "Use the activate endpoint."
            )
        return value


# =========================================================
# LAB TEST RESULT SERIALIZER
# =========================================================

class LabTestResultSerializer(EnterpriseModelSerializer):

    # Read-only enriched fields for UI display
    patient_name = serializers.SerializerMethodField()
    test_name = serializers.SerializerMethodField()
    request_code = serializers.SerializerMethodField()
    appointment_id = serializers.SerializerMethodField()
    appointment_code = serializers.SerializerMethodField()
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = LabTestResult
        fields = [
            "result_id",
            "request",
            "request_code",
            "appointment_id",
            "appointment_code",
            "patient_name",
            "test_name",
            "parameter_name",
            "result_value",
            "value",
            "unit",
            "reference_range",
            "reference_min",
            "reference_max",
            "is_abnormal",
            "has_report",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "result_id",
            "result_value",   # auto-computed from value
            "is_abnormal",
            "has_report",
            "patient_name",
            "test_name",
            "request_code",
            "appointment_id",
            "appointment_code",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        try:
            p = obj.request.appointment.patient
            return f"{p.first_name} {p.last_name}".strip()
        except AttributeError:
            return None

    def get_test_name(self, obj):
        try:
            return obj.request.lab_test.test_name
        except AttributeError:
            return None

    def get_request_code(self, obj):
        try:
            return obj.request.lab_test_request_id
        except AttributeError:
            return None

    def get_appointment_id(self, obj):
        try:
            return obj.request.appointment.appointment_id
        except AttributeError:
            return None

    def get_appointment_code(self, obj):
        try:
            return obj.request.appointment.appointment_code
        except AttributeError:
            return None

    def get_has_report(self, obj):
        return LabReport.objects.filter(
            request=obj.request,
            is_deleted=False,
        ).exists()

    def validate_parameter_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Parameter name cannot be empty.")
        if len(value) > 15:
            raise serializers.ValidationError(
                "Parameter name cannot exceed 15 characters."
            )
        if not re.match(r'^[A-Za-z0-9 ]+$', value):
            raise serializers.ValidationError("Enter a valid value")
        return value

    def validate_value(self, value):
        if value is None:
            raise serializers.ValidationError("Numeric result value is required.")
        if value < Decimal("1") or value > Decimal("500"):
            raise serializers.ValidationError(
                "Result value must be a number between 1 and 500."
            )
        return value

    def validate(self, attrs):
        request_obj = attrs.get("request") or (
            self.instance.request if self.instance else None
        )

        # Role check
        http_request = self.context.get("request")
        if not http_request or not http_request.user.groups.filter(
            name="LabTechnician"
        ).exists():
            raise serializers.ValidationError(
                {"technician": "Only lab technicians can enter results."}
            )

        if not request_obj:
            raise serializers.ValidationError(
                {"request": "Lab request is required."}
            )

        if request_obj.is_deleted:
            raise serializers.ValidationError(
                "Cannot add result to deleted request."
            )

        # New results can only be added while ORDERED
        if not self.instance and request_obj.status != LabRequestStatus.ORDERED:
            raise serializers.ValidationError(
                "Results can only be added while request is in ORDERED stage."
            )

        # Existing results cannot be edited once a report has been generated
        if self.instance:
            report_exists = LabReport.objects.filter(
                request=request_obj,
                is_deleted=False,
            ).exists()
            if report_exists:
                raise serializers.ValidationError(
                    "After report creation, lab results cannot be edited."
                )

        ref_min = attrs.get("reference_min")
        ref_max = attrs.get("reference_max")
        if ref_min is not None and ref_max is not None:
            if ref_min > ref_max:
                raise serializers.ValidationError(
                    {"reference_min": "reference_min cannot exceed reference_max."}
                )

        if self.instance and "request" in attrs:
            if attrs["request"] != self.instance.request:
                raise serializers.ValidationError(
                    {"request": "Request cannot be changed after result creation."}
                )

        return attrs

    def _auto_fill(self, validated_data):
        """Auto-compute result_value and reference_range from numeric fields."""
        value = validated_data.get("value")
        unit = validated_data.get("unit", "") or ""
        if value is not None:
            validated_data["result_value"] = f"{value} {unit}".strip()

        ref_min = validated_data.get("reference_min")
        ref_max = validated_data.get("reference_max")
        if ref_min is not None and ref_max is not None:
            if not validated_data.get("reference_range"):
                validated_data["reference_range"] = f"{ref_min} – {ref_max}"

        return validated_data

    def create(self, validated_data):
        request = self.context["request"]
        if not hasattr(request.user, "staff_profile"):
            raise serializers.ValidationError(
                {"technician": "Staff profile not found."}
            )
        validated_data["technician"] = request.user.staff_profile
        validated_data = self._auto_fill(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._auto_fill(validated_data)
        return super().update(instance, validated_data)


# =========================================================
# LAB REPORT SERIALIZER
# =========================================================

class LabReportSerializer(EnterpriseModelSerializer):

    # Enriched read-only fields for structured view
    patient_name = serializers.SerializerMethodField()
    patient_blood_group = serializers.SerializerMethodField()
    patient_phone = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    doctor_specialization = serializers.SerializerMethodField()
    doctor_code = serializers.SerializerMethodField()
    test_name = serializers.SerializerMethodField()
    request_code = serializers.SerializerMethodField()
    appointment_id = serializers.SerializerMethodField()
    appointment_code = serializers.SerializerMethodField()
    results = serializers.SerializerMethodField()

    class Meta:
        model = LabReport
        fields = [
            "report_id",
            "request",
            "request_code",
            "appointment_id",
            "appointment_code",
            "generated_by",
            "report_date",
            "completed_at",
            "status",
            "overall_interpretation",
            # Enriched read fields
            "patient_name",
            "patient_blood_group",
            "patient_phone",
            "doctor_name",
            "doctor_specialization",
            "doctor_code",
            "test_name",
            "results",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "report_id",
            "generated_by",
            "report_date",
            "completed_at",
            "patient_name",
            "patient_blood_group",
            "patient_phone",
            "doctor_name",
            "doctor_specialization",
            "doctor_code",
            "test_name",
            "request_code",
            "appointment_id",
            "appointment_code",
            "results",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        try:
            p = obj.request.appointment.patient
            return f"{p.first_name} {p.last_name}".strip()
        except AttributeError:
            return None

    def get_patient_blood_group(self, obj):
        try:
            return obj.request.appointment.patient.blood_group
        except AttributeError:
            return None

    def get_patient_phone(self, obj):
        try:
            return obj.request.appointment.patient.phone
        except AttributeError:
            return None

    def get_doctor_name(self, obj):
        try:
            u = obj.request.appointment.doctor.staff.user
            return f"{u.first_name} {u.last_name}".strip()
        except AttributeError:
            return None

    def get_doctor_specialization(self, obj):
        try:
            return obj.request.appointment.doctor.specialization.name
        except AttributeError:
            return None

    def get_doctor_code(self, obj):
        try:
            return obj.request.appointment.doctor.staff.staff_code
        except AttributeError:
            return None

    def get_test_name(self, obj):
        """
        Return a comma-separated list of ALL test names for this appointment.
        Consolidates across all requests so the report reflects every ordered test.
        """
        try:
            appointment = obj.request.appointment
            names = list(
                LabTestRequest.objects.filter(
                    appointment=appointment,
                    is_deleted=False,
                ).exclude(
                    status=LabRequestStatus.CANCELLED
                ).values_list("lab_test__test_name", flat=True)
            )
            return ", ".join(n for n in names if n)
        except Exception:
            # Fallback to single test name
            try:
                return obj.request.lab_test.test_name
            except AttributeError:
                return None

    def get_request_code(self, obj):
        try:
            return obj.request.lab_test_request_id
        except AttributeError:
            return None

    def get_appointment_id(self, obj):
        try:
            return obj.request.appointment.appointment_id
        except AttributeError:
            return None

    def get_appointment_code(self, obj):
        try:
            return obj.request.appointment.appointment_code
        except AttributeError:
            return None

    def get_results(self, obj):
        """
        Return ALL results for ALL completed requests under this appointment.
        This consolidates every test's parameters into a single report view,
        fulfilling the one-report-per-appointment, all-inclusive requirement.
        """
        try:
            appointment = obj.request.appointment
            qs = LabTestResult.objects.filter(
                request__appointment=appointment,
                is_deleted=False,
            ).select_related(
                "request__lab_test",
            ).order_by("request__lab_test__test_name", "parameter_name")
            return LabTestResultSerializer(qs, many=True, context=self.context).data
        except Exception:
            return []

    def validate(self, attrs):
        request_obj = attrs.get("request") or (
            self.instance.request if self.instance else None
        )

        if not self.instance and request_obj:
            # ── Appointment-level checks for new reports ────────────────────
            try:
                appointment = request_obj.appointment
            except AttributeError:
                raise serializers.ValidationError(
                    "Lab request must be linked to a valid appointment."
                )

            # RULE: ONE report per appointment — block if any request under
            # this appointment already has a report.
            existing_report = LabReport.objects.filter(
                request__appointment=appointment,
                is_deleted=False,
            ).exists()
            if existing_report:
                raise serializers.ValidationError(
                    "A lab report already exists for this appointment. "
                    "Only one consolidated report is allowed per appointment."
                )

            # RULE: ALL test requests for the appointment must be COMPLETED
            # (or CANCELLED) before a report can be generated.
            incomplete_tests = LabTestRequest.objects.filter(
                appointment=appointment,
                is_deleted=False,
            ).exclude(
                status__in=[LabRequestStatus.COMPLETED, LabRequestStatus.CANCELLED]
            )
            if incomplete_tests.exists():
                raise serializers.ValidationError(
                    "Cannot generate the report until all test requests for the "
                    "appointment are completed."
                )

            # RULE: Lab bill must be PAID before a report can be generated.
            if not LabBill.objects.filter(
                appointment=appointment,
                status=LabBill.Status.PAID,
                is_deleted=False
            ).exists():
                raise serializers.ValidationError(
                    "Lab report can only be generated after this appointment's "
                    "lab bill is fully paid."
                )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        if not hasattr(request.user, "staff_profile"):
            raise serializers.ValidationError(
                {"generated_by": "Staff profile not found."}
            )
        validated_data["generated_by"] = request.user.staff_profile
        # Auto-fill completed_at
        if "completed_at" not in validated_data or not validated_data.get("completed_at"):
            validated_data["completed_at"] = timezone.now()
        return super().create(validated_data)


# =========================================================
# LAB BILL ITEM SERIALIZER
# =========================================================

class LabBillItemSerializer(EnterpriseModelSerializer):

    test_name = serializers.CharField(source="test_catalog.test_name", read_only=True)

    class Meta:
        model = LabBillItem
        fields = [
            "id",
            "lab_bill",
            "test_catalog",
            "test_name",
            "quantity",
            "unit_price",
            "subtotal",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "subtotal",
            "test_name",
            "created_at",
            "updated_at",
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter a valid non-zero value.")
        return value

    def validate_unit_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Enter a valid non-zero value.")
        return value

    def validate(self, attrs):
        test_catalog = attrs.get("test_catalog") or (
            self.instance.test_catalog if self.instance else None
        )
        unit_price = attrs.get("unit_price") or (
            self.instance.unit_price if self.instance else None
        )

        if test_catalog is not None and unit_price is not None:
            if unit_price != test_catalog.test_charge:
                raise serializers.ValidationError(
                    "Unit price must match catalog test charge."
                )

        if test_catalog and test_catalog.status != LabTestStatus.ACTIVE:
            raise serializers.ValidationError(
                {"test_catalog": "Cannot bill inactive lab tests."}
            )

        if self.instance and "lab_bill" in attrs:
            if attrs["lab_bill"] != self.instance.lab_bill:
                raise serializers.ValidationError(
                    {"lab_bill": "Bill cannot be changed after item creation."}
                )

        return attrs


# =========================================================
# LAB BILL SERIALIZER
# =========================================================

class LabBillSerializer(EnterpriseModelSerializer):

    items = LabBillItemSerializer(many=True, read_only=True)
    patient_name = serializers.SerializerMethodField()
    appointment_code = serializers.SerializerMethodField()
    paid_at_ist = serializers.SerializerMethodField()

    class Meta:
        model = LabBill
        fields = [
            "lab_bill_id",
            "lab_bill_code",
            "patient",
            "patient_name",
            "appointment",
            "appointment_code",
            "status",
            "total_amount",
            "paid_at",
            "paid_at_ist",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "lab_bill_id",
            "lab_bill_code",
            "patient_name",
            "appointment",
            "appointment_code",
            "total_amount",
            "paid_at",
            "paid_at_ist",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        try:
            p = obj.patient
            return f"{p.first_name} {p.last_name}".strip()
        except AttributeError:
            return None

    def get_appointment_code(self, obj):
        try:
            return obj.appointment.appointment_code
        except AttributeError:
            return None

    def get_paid_at_ist(self, obj):
        if not obj.paid_at:
            return None
        import pytz
        IST = pytz.timezone("Asia/Kolkata")
        paid_ist = obj.paid_at.astimezone(IST)
        return paid_ist.strftime("%d %b %Y, %I:%M %p IST")

    def validate_status(self, value):
        if self.instance and self.instance.status == LabBill.Status.PAID:
            raise serializers.ValidationError("Paid bill cannot be modified.")
        return value

    def validate(self, attrs):
        patient = attrs.get("patient") or getattr(self.instance, "patient", None)

        if patient and getattr(patient, "is_deleted", False):
            raise serializers.ValidationError(
                {"patient": "Cannot create bill for deleted patient."}
            )

        if self.instance and "patient" in attrs:
            if attrs["patient"] != self.instance.patient:
                raise serializers.ValidationError(
                    {"patient": "Patient cannot be changed after bill creation."}
                )

        return attrs

    def update(self, instance, validated_data):
        """
        Explicit update with update_fields to prevent stale in-memory field values
        (e.g. total_amount=0 fetched before items were generated) from overwriting
        correctly computed DB values when saving a status change.
        """
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        save_fields = list(validated_data.keys()) + ["updated_at"]
        # Include paid_at if it was set on the instance by perform_update
        if instance.paid_at is not None and "paid_at" not in save_fields:
            save_fields.append("paid_at")
        instance.save(update_fields=save_fields)
        return instance

from django.db import models, transaction
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
import re
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone
from common.models import BaseModel
from doctor.models import LabTestRequest, LabRequestStatus


# =========================================================
# HELPERS
# =========================================================

def _validate_no_special_chars(value, field_label="Value"):
    """Reject special characters: $ # % & * @ ! ^ < > = + | \\ / ; : \" ' ` ~ """
    if re.search(r'[$#%&*@!^<>=+|\\\/;:\"\'\`~]', value):
        raise ValidationError("Enter a valid value")


def _validate_no_consecutive(value, field_label="Value", max_run=3):
    """Reject more than max_run consecutive identical characters."""
    if re.search(r'(.)\1{' + str(max_run) + r',}', value):
        raise ValidationError(
            "Same character cannot be repeated more than 3 times"
        )


def _validate_not_only_spaces(value, field_label="Value"):
    if value and not value.strip():
        raise ValidationError("Enter a valid value")


# =========================================================
# LAB TEST CATALOG
# =========================================================

class LabTestStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class LabTestCatalog(BaseModel):

    lab_test_id = models.AutoField(primary_key=True)

    lab_test_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    # Max 20 chars enforced by clean(); DB field max_length=20
    test_name = models.CharField(max_length=20, unique=True)

    description = models.TextField(blank=True, null=True)

    test_charge = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("50.00"))]
    )

    status = models.CharField(
        max_length=20,
        choices=LabTestStatus.choices,
        default=LabTestStatus.ACTIVE
    )

    class Meta:
        db_table = "lab_test_catalog"
        ordering = ["test_name"]
        indexes = [
            models.Index(fields=["status"])
        ]

    def clean(self):

        # --- Lab test code ---
        if self.lab_test_code:
            self.lab_test_code = self.lab_test_code.strip().upper()
            if len(self.lab_test_code) < 3:
                raise ValidationError("Lab test code must be at least 3 characters.")
            if not re.match(r'^[A-Z0-9_-]+$', self.lab_test_code):
                raise ValidationError("Invalid lab test code format.")

        # --- Test name ---
        if self.test_name:
            self.test_name = self.test_name.strip()

        if not self.test_name:
            raise ValidationError("Test name cannot be empty.")

        _validate_not_only_spaces(self.test_name, "Test name")

        if len(self.test_name) < 3:
            raise ValidationError("Test name must be at least 3 characters.")

        if len(self.test_name) > 20:
            raise ValidationError("Test name cannot exceed 20 characters.")

        if not re.match(r'^[A-Za-z ]+$', self.test_name):
            raise ValidationError(
                "Test name can only contain letters and spaces. No special characters allowed."
            )

        _validate_no_consecutive(self.test_name, "Test name")

        # --- Description ---
        if self.description:
            self.description = self.description.strip()

            if not self.description:
                self.description = None
            else:
                _validate_not_only_spaces(self.description, "Description")

                if len(self.description) > 100:
                    raise ValidationError("Description cannot exceed 100 characters.")

                _validate_no_special_chars(self.description, "Description")

                _validate_no_consecutive(self.description, "Description")

        # --- Test charge ---
        if self.test_charge is None:
            raise ValidationError("Test charge is required.")

        if self.test_charge <= 0:
            raise ValidationError("Enter a valid non-zero value.")

        if self.test_charge < Decimal("50"):
            raise ValidationError("Test charge must be at least ₹50.")

        if self.test_charge > Decimal("5000"):
            raise ValidationError("Test charge cannot exceed ₹5000.")

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        with transaction.atomic():
            if not is_new:
                LabTestCatalog.objects.select_for_update().filter(pk=self.pk).first()

            self.full_clean()
            super().save(*args, **kwargs)

            if is_new and not self.lab_test_code:
                self.lab_test_code = f"LT{str(self.lab_test_id).zfill(6)}"
                super().save(update_fields=["lab_test_code"])

    def __str__(self):
        return f"{self.lab_test_code} - {self.test_name}"


# =========================================================
# LAB TEST PARAMETERS (catalog-level)
# =========================================================

class LabTestParameter(BaseModel):
    """
    Defines the expected parameters for a given lab test in the catalog.
    When a technician enters results, parameters are auto-fetched from here.
    """

    parameter_id = models.AutoField(primary_key=True)

    lab_test = models.ForeignKey(
        LabTestCatalog,
        on_delete=models.CASCADE,
        related_name="parameters"
    )

    # Letters only (A-Z, a-z), 3–15 chars
    parameter_name = models.CharField(max_length=15)

    # Minimum reference value (≥ 1)
    reference_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("1"))]
    )

    # Maximum reference value (≤ 500)
    reference_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MaxValueValidator(Decimal("500"))]
    )

    # Required unit
    unit = models.CharField(max_length=50, default="")

    class Meta:
        db_table = "lab_test_parameters"
        constraints = [
            models.UniqueConstraint(
                fields=["lab_test", "parameter_name"],
                name="unique_parameter_per_test"
            )
        ]

    def clean(self):
        # --- Parameter name ---
        if self.parameter_name:
            self.parameter_name = self.parameter_name.strip()

        if not self.parameter_name:
            raise ValidationError("Parameter name cannot be empty.")

        if len(self.parameter_name) < 3:
            raise ValidationError("Parameter name must be at least 3 characters.")

        if len(self.parameter_name) > 15:
            raise ValidationError("Parameter name cannot exceed 15 characters.")

        if not re.match(r'^[A-Za-z]+$', self.parameter_name):
            raise ValidationError(
                "Parameter name can only contain letters. No spaces or special characters allowed."
            )

        # --- Reference Min ---
        if self.reference_min is None:
            raise ValidationError("Reference minimum value is required.")

        if self.reference_min < Decimal("1"):
            raise ValidationError("Reference minimum value must be at least 1.")

        # --- Reference Max ---
        if self.reference_max is None:
            raise ValidationError("Reference maximum value is required.")

        if self.reference_max > Decimal("500"):
            raise ValidationError("Reference maximum value cannot exceed 500.")

        # --- Min < Max ---
        if self.reference_min >= self.reference_max:
            raise ValidationError("Reference minimum must be less than maximum.")

        # --- Unit ---
        if self.unit:
            self.unit = self.unit.strip()

        if not self.unit:
            raise ValidationError("Unit is required.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.lab_test.test_name} - {self.parameter_name}"


# =========================================================
# LAB TEST RESULTS
# =========================================================

class LabTestResult(BaseModel):

    result_id = models.AutoField(primary_key=True)

    request = models.ForeignKey(
        LabTestRequest,
        on_delete=models.CASCADE,
        related_name="results"
    )

    # Pre-filled from catalog parameter; max 15 chars
    parameter_name = models.CharField(max_length=15)

    # Auto-computed from numeric value; no longer entered by user
    result_value = models.CharField(max_length=255, blank=True, default="")

    value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    unit = models.CharField(max_length=50, blank=True, null=True)

    reference_range = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    reference_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    reference_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    is_abnormal = models.BooleanField(default=False)

    technician = models.ForeignKey(
        "administration.Staff",
        on_delete=models.PROTECT,
        related_name="performed_tests"
    )

    class Meta:
        db_table = "lab_test_results"
        constraints = [
            models.UniqueConstraint(
                fields=["request", "parameter_name"],
                name="unique_parameter_per_request"
            )
        ]

    def clean(self):

        if self.parameter_name:
            self.parameter_name = self.parameter_name.strip()

        if not self.parameter_name:
            raise ValidationError("Parameter name cannot be empty.")

        if len(self.parameter_name) > 15:
            raise ValidationError("Parameter name cannot exceed 15 characters.")

        # result_value is auto-computed — strip if manually set
        if self.result_value:
            self.result_value = self.result_value.strip()

        if self.value is None:
            raise ValidationError("Numeric result value required.")

        if self.value < Decimal("1") or self.value > Decimal("500"):
            raise ValidationError("Result value must be a number between 1 and 500.")

        if self.reference_min is not None and self.reference_max is not None:
            if self.reference_min > self.reference_max:
                raise ValidationError(
                    "Reference min cannot be greater than reference max."
                )

        if self.request.is_deleted:
            raise ValidationError("Cannot add results to deleted request.")

        # New results can only be added while ORDERED
        if not self.pk and self.request.status != LabRequestStatus.ORDERED:
            raise ValidationError(
                "Results can only be added while request is in ORDERED stage."
            )

        # Existing results cannot be edited once a report has been generated
        if self.pk:
            report_exists = LabReport.objects.filter(
                request=self.request,
                is_deleted=False,
            ).exists()
            if report_exists:
                raise ValidationError(
                    "After report creation, lab results cannot be edited."
                )

        if not self.technician.user.groups.filter(name="LabTechnician").exists():
            raise ValidationError("Only lab technicians can enter results.")

        self.is_abnormal = False

        if self.reference_min is not None and self.value is not None:
            if self.value < self.reference_min:
                self.is_abnormal = True

        if self.reference_max is not None and self.value is not None:
            if self.value > self.reference_max:
                self.is_abnormal = True

    def save(self, *args, **kwargs):
        with transaction.atomic():
            LabTestRequest.objects.select_for_update().get(pk=self.request.pk)
            if self.pk:
                LabTestResult.objects.select_for_update().get(pk=self.pk)
            self.full_clean()
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.parameter_name}: {self.result_value}"


# =========================================================
# LAB REPORTS
# =========================================================

class ReportStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    FINAL = "FINAL", "Final"
    AMENDED = "AMENDED", "Amended"


class LabReport(BaseModel):

    report_id = models.AutoField(primary_key=True)

    request = models.OneToOneField(
        LabTestRequest,
        on_delete=models.CASCADE,
        related_name="report"
    )

    generated_by = models.ForeignKey(
        "administration.Staff",
        on_delete=models.PROTECT,
        related_name="generated_reports"
    )

    report_date = models.DateTimeField(auto_now_add=True)

    # collected_at is optional (kept for data compatibility)
    collected_at = models.DateTimeField(null=True, blank=True)

    # Auto-set to now() on report creation
    completed_at = models.DateTimeField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT
    )

    overall_interpretation = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "lab_reports"
        ordering = ["-report_date"]

    def clean(self):

        if self.overall_interpretation:
            self.overall_interpretation = self.overall_interpretation.strip()
            _validate_no_special_chars(self.overall_interpretation, "Interpretation")

        if self.request.status != LabRequestStatus.COMPLETED:
            raise ValidationError(
                "Report can only be generated after test completion."
            )

        if not self.generated_by or self.generated_by.role != "LabTechnician":
            raise ValidationError("Only lab technicians can generate reports.")

        if not self.request.results.exists():
            raise ValidationError("Cannot generate report without results.")

        # ── BILLING ENFORCEMENT ───────────────────────────────────────────
        # Report is only allowed once this appointment's lab bill is PAID.
        # Appointment-scoped check prevents cross-appointment data leakage.
        if not self.pk:  # new report only
            appointment = self.request.appointment
            paid_bill_exists = LabBill.objects.filter(
                appointment=appointment,
                status=LabBill.Status.PAID,
                is_deleted=False,
            ).exists()
            if not paid_bill_exists:
                raise ValidationError(
                    "Lab report can only be generated after this appointment's lab bill is fully paid."
                )

        if self.completed_at and self.collected_at:
            if self.completed_at < self.collected_at:
                raise ValidationError(
                    "Completed date cannot be before collected date."
                )

        if self.pk:
            old = LabReport.objects.get(pk=self.pk)
            if old.status == ReportStatus.FINAL:
                raise ValidationError("Final report cannot be modified.")

            allowed_transitions = {
                ReportStatus.DRAFT: [ReportStatus.FINAL, ReportStatus.AMENDED],
                ReportStatus.AMENDED: [ReportStatus.FINAL],
                ReportStatus.FINAL: []
            }

            if self.status != old.status:
                if self.status not in allowed_transitions.get(old.status, []):
                    raise ValidationError(
                        f"Invalid report status transition from {old.status} to {self.status}"
                    )

    def save(self, *args, **kwargs):
        # Auto-fill completed_at on first creation
        if not self.pk and not self.completed_at:
            self.completed_at = timezone.now()

        with transaction.atomic():
            if self.pk:
                LabReport.objects.select_for_update().get(pk=self.pk)
            self.full_clean()
            super().save(*args, **kwargs)

    def __str__(self):
        return f"REP-{self.report_id}"


# =========================================================
# LAB BILL
# =========================================================

class LabBill(BaseModel):

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PAID = "PAID", "Paid"
        CANCELLED = "CANCELLED", "Cancelled"

    lab_bill_id = models.AutoField(primary_key=True)

    lab_bill_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True
    )

    patient = models.ForeignKey(
        "reception.Patient",
        on_delete=models.PROTECT,
        related_name="lab_bills"
    )

    # Each bill is scoped to exactly one appointment.
    # Nullable to preserve backward compatibility with pre-migration records.
    appointment = models.ForeignKey(
        "reception.Appointment",
        on_delete=models.PROTECT,
        related_name="lab_bill",
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    # Set automatically when the bill is marked PAID
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lab_bills"
        indexes = [
            models.Index(fields=["status"])
        ]
        constraints = [
            # One non-deleted bill per appointment (partial unique index)
            models.UniqueConstraint(
                fields=["appointment"],
                condition=models.Q(appointment__isnull=False, is_deleted=False),
                name="unique_active_bill_per_appointment",
            )
        ]

    def recalculate_total(self):
        total = self.items.aggregate(total=Sum("subtotal"))["total"] or 0
        self.total_amount = total
        self.save(update_fields=["total_amount", "updated_at"])

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        with transaction.atomic():
            super().save(*args, **kwargs)
            if is_new and not self.lab_bill_code:
                self.lab_bill_code = f"LB{str(self.lab_bill_id).zfill(6)}"
                super().save(update_fields=["lab_bill_code"])

    def __str__(self):
        return self.lab_bill_code


# =========================================================
# LAB BILL ITEMS
# =========================================================

class LabBillItem(BaseModel):

    id = models.AutoField(primary_key=True)

    lab_bill = models.ForeignKey(
        LabBill,
        on_delete=models.PROTECT,
        related_name="items"
    )

    test_catalog = models.ForeignKey(
        LabTestCatalog,
        on_delete=models.PROTECT
    )

    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))]
    )

    subtotal = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    class Meta:
        db_table = "lab_bill_items"
        constraints = [
            models.UniqueConstraint(
                fields=["lab_bill", "test_catalog"],
                name="unique_test_per_bill"
            )
        ]

    def save(self, *args, **kwargs):
        if self.lab_bill.status == LabBill.Status.PAID:
            raise ValidationError("Cannot modify items of a paid bill.")

        if self.test_catalog.status != LabTestStatus.ACTIVE:
            raise ValidationError("Inactive lab tests cannot be billed.")

        self.subtotal = self.quantity * self.unit_price

        with transaction.atomic():
            super().save(*args, **kwargs)
            self.lab_bill.recalculate_total()

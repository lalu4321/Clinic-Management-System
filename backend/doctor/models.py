from django.db import models , transaction
from django.db.models import Q
from django.core.validators import MinValueValidator, MinLengthValidator
from django.core.exceptions import ValidationError
from reception.models import AppointmentStatus
from reception.models import BillStatus
from common.models import BaseModel
from django.utils import timezone

# =========================================================
# PRESCRIPTION STATUS
# =========================================================

class PrescriptionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    ACTIVE = "ACTIVE", "Active"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


# =========================================================
# PRESCRIPTION MODEL
# =========================================================



class Prescription(BaseModel):
    

    prescription_id = models.AutoField(primary_key=True)

    prescription_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    appointment = models.OneToOneField(
        "reception.Appointment",
        on_delete=models.PROTECT,
        related_name="prescription"
    )

    symptoms = models.TextField(blank=True)
    diagnosis = models.TextField(blank=True)
    status = models.CharField(
    max_length=20,
    choices=PrescriptionStatus.choices,
    default=PrescriptionStatus.DRAFT
    )
    
    STATE_MACHINE = {
    PrescriptionStatus.DRAFT: {
        PrescriptionStatus.ACTIVE,
        PrescriptionStatus.CANCELLED,
    },
    PrescriptionStatus.ACTIVE: {
        PrescriptionStatus.COMPLETED,
        PrescriptionStatus.CANCELLED,
    },
    PrescriptionStatus.COMPLETED: set(),
    PrescriptionStatus.CANCELLED: set(),
}
    
    
    
    @property
    def patient(self):
        return self.appointment.patient


    @property
    def doctor(self):
        return self.appointment.doctor
    

    class Meta:
        db_table = "prescriptions"
        ordering = ["-created_at"]

    def clean(self):

        if self.is_deleted:
            raise ValidationError("Cannot modify deleted prescription.")

        self.symptoms = (self.symptoms or "").strip()
        self.diagnosis = (self.diagnosis or "").strip()

        # Draft can be incomplete
        if self.status != PrescriptionStatus.DRAFT:

            if not self.symptoms:
                raise ValidationError("Symptoms are required.")

            if not self.diagnosis:
                raise ValidationError("Diagnosis is required.")

        # Prevent prescription for invalid appointment
        if not self.appointment:
            raise ValidationError("Appointment is required.")

        if self.appointment.status not in [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.COMPLETED
        ]:
            raise ValidationError(
                "Prescription allowed only for appointments in progress or completed."
            )

        if not hasattr(self.appointment, "consultation_bill") or \
            self.appointment.consultation_bill.status != BillStatus.PAID:
            raise ValidationError("Prescription requires paid consultation.")

        if self.pk:
            original = Prescription.objects.select_for_update().get(pk=self.pk)

            if original.status != self.status:
                allowed = self.STATE_MACHINE.get(original.status, set())
                if self.status not in allowed:
                    raise ValidationError("Invalid prescription status transition.")

            if (original.status in [
                    PrescriptionStatus.DRAFT,
                    PrescriptionStatus.ACTIVE
                ]
                and self.status == PrescriptionStatus.CANCELLED
            ):
                active_items = (
                    self.items
                    .filter(is_deleted=False)
                    .select_for_update()
                )
                if active_items.exists():
                    raise ValidationError(
                        "Cannot cancel prescription with active items."
                    )
    def save(self, *args, **kwargs):
        
        is_new = self.pk is None

        with transaction.atomic():
            if not is_new:
                Prescription.objects.select_for_update().filter(pk=self.pk).exists()

            self.full_clean()
            super().save(*args, **kwargs)

            if is_new and not self.prescription_code:
                self.prescription_code = f"PR{str(self.prescription_id).zfill(6)}"
                super().save(update_fields=["prescription_code"])
                    
    def delete(self, *args, **kwargs):
        if self.is_deleted:
            return
        with transaction.atomic():
            Prescription.objects.select_for_update().get(pk=self.pk)

            active_items = (
                self.items
                .filter(is_deleted=False)
                .select_for_update()
            )

            if active_items.exists():
                raise ValidationError(
                    "Cannot delete prescription with active items."
                )

            self.is_deleted = True
            super().save(update_fields=["is_deleted", "updated_at"])
    def __str__(self):
        return f"{self.prescription_code}"
        


# =========================================================
# PRESCRIPTION ITEMS
# =========================================================

class PrescriptionItem(BaseModel):

    prescription_item_id = models.AutoField(primary_key=True)

    prescription = models.ForeignKey(
        "doctor.Prescription",
        on_delete=models.PROTECT,
        related_name="items"
    )

    medicine = models.ForeignKey(
        "pharmacist.Medicine",
        on_delete=models.PROTECT,
        related_name="prescription_items"
    )

    dosage = models.CharField(max_length=100)

    frequency = models.CharField(max_length=100)

    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    class Meta:
        db_table = "prescription_items"
        ordering = ["prescription"]
        
        constraints = [
            models.UniqueConstraint(
                fields=["prescription", "medicine"],
                condition=Q(is_deleted=False),
                name="%(app_label)s_%(class)s_unique_medicine_per_prescription"
            )
        ]

    def clean(self):
        if self.quantity is None or self.quantity <= 0:
            raise ValidationError("Quantity must be greater than 0")
        
        if self.is_deleted:
            raise ValidationError("Cannot modify deleted record.")
    
    def save(self, *args, **kwargs):
        with transaction.atomic():
            prescription = (
                Prescription.objects
                .select_for_update()
                .get(pk=self.prescription.pk)
            )

            if prescription.is_deleted:
                raise ValidationError("Cannot modify deleted prescription.")

            if prescription.status not in [
                PrescriptionStatus.DRAFT,
                PrescriptionStatus.ACTIVE
            ]:
                raise ValidationError("Cannot modify finalized prescription.")

            self.full_clean()
            super().save(*args, **kwargs)
        
    def delete(self, *args, **kwargs):

        if self.is_deleted:
            return

        with transaction.atomic():

            prescription = Prescription.objects.select_for_update().get(
                pk=self.prescription.pk
            )

            if prescription.status not in [
                PrescriptionStatus.DRAFT,
                PrescriptionStatus.ACTIVE
            ]:
                raise ValidationError(
                    "Cannot modify non-active prescription."
                )

            self.is_deleted = True
            super().save(update_fields=["is_deleted", "updated_at"])
        
    def __str__(self):
        return f"{self.prescription.prescription_code} - {self.medicine.med_name}"



# =========================================================
# LAB TEST REQUEST STATUS
# =========================================================

class LabRequestStatus(models.TextChoices):
    ORDERED = "ORDERED", "Ordered"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


# =========================================================
# LAB TEST REQUEST
# =========================================================

class LabTestRequest(BaseModel):

    lab_test_request_id = models.AutoField(primary_key=True)

    appointment = models.ForeignKey(
        "reception.Appointment",
        on_delete=models.PROTECT,
        related_name="lab_test_requests"
    )

    lab_test = models.ForeignKey(
        "labtechinician.LabTestCatalog",
        on_delete=models.PROTECT,
        related_name="lab_test_requests"
    )

    notes = models.TextField(
        blank=True,
        null=True
    )

    status = models.CharField(
        max_length=20,
        choices=LabRequestStatus.choices,
        default=LabRequestStatus.ORDERED
    )
    
    STATE_MACHINE = {
        LabRequestStatus.ORDERED: {
            LabRequestStatus.COMPLETED,
            LabRequestStatus.CANCELLED,
        },
        LabRequestStatus.COMPLETED: set(),
        LabRequestStatus.CANCELLED: set(),
    }

    class Meta:
        db_table = "lab_test_requests"
        ordering = ["-created_at"]
        
        constraints = [
            models.UniqueConstraint(
                fields=["appointment", "lab_test"],
                condition=Q(is_deleted=False),
                name="%(app_label)s_%(class)s_unique_active_test"
            )
        ]
        

    def clean(self):
        if self.is_deleted:
            raise ValidationError("Cannot modify deleted lab request.")
        # Prevent lab test for cancelled appointment
        if not self.appointment:
            raise ValidationError("Appointment is required.")
        
        if self.appointment.status not in [
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.COMPLETED
        ]:
             raise ValidationError(
                                    "Lab request allowed only for active consultations."
            )
        if self.pk:
            original = LabTestRequest.objects.select_for_update().get(pk=self.pk)
            if original.status != self.status:
                allowed = self.STATE_MACHINE.get(original.status, set())
                if self.status not in allowed:
                    raise ValidationError("Invalid lab request status transition.")
                
    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.pk:
                LabTestRequest.objects.select_for_update().get(pk=self.pk)
            self.full_clean()
            super().save(*args, **kwargs)
                    
    def delete(self, *args, **kwargs):
        if self.is_deleted:
            return

        with transaction.atomic():
            # Lock the row
            LabTestRequest.objects.select_for_update().get(pk=self.pk)
            # Use queryset update to bypass save() and clean() entirely
            LabTestRequest.objects.filter(pk=self.pk).update(
                is_deleted=True,
                updated_at=timezone.now()
            )
            self.is_deleted = True  # keep in-memory object consistent

    def __str__(self):
        return f"{self.appointment.appointment_code} - {self.lab_test.test_name}"
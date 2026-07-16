import re
from django.db import models, transaction
from django.db.models import F, Sum, Q
from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from common.models import BaseModel
from doctor.models import PrescriptionStatus
from django.db.models.expressions import CombinedExpression


# =========================================================
# VALIDATION HELPERS
# =========================================================

def _has_excessive_consecutive(value, max_repeat=3):
    """Return True if any character repeats more than max_repeat times in a row."""
    return bool(re.search(r'(.)\1{' + str(max_repeat) + r',}', value))


def _validate_name_field(value, field_label, min_len=2, max_len=20, allow_numbers=False):
    """
    Validate a text field (company/generic/supplier name or medicine name).

    allow_numbers=False → letters + spaces only
    allow_numbers=True  → letters + numbers + spaces
    Returns an error string or None.
    """
    if not value:
        return f"{field_label} is required."

    trimmed = value.strip()

    if not trimmed:
        return f"{field_label} cannot be whitespace only."

    # Reject multiple consecutive internal spaces
    if "  " in trimmed:
        return f"{field_label} cannot contain multiple consecutive spaces."

    if len(trimmed) < min_len:
        return f"{field_label} must be at least {min_len} characters."

    if len(trimmed) > max_len:
        return f"{field_label} must not exceed {max_len} characters."

    if allow_numbers:
        if not re.match(r'^[A-Za-z0-9 ]+$', trimmed):
            return f"{field_label} may only contain letters, numbers, and spaces."
        if not re.search(r'[A-Za-z]', trimmed):
            return f"{field_label} must contain at least one letter."
    else:
        if not re.match(r'^[A-Za-z ]+$', trimmed):
            return f"{field_label} may only contain letters and spaces."

    if _has_excessive_consecutive(trimmed.replace(" ", ""), max_repeat=3):
        return f"{field_label}: same character cannot be repeated more than 3 times consecutively."

    return None


# =========================================================
# MEDICINE
# =========================================================

class MedicineStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class Medicine(BaseModel):

    med_id = models.AutoField(primary_key=True)

    medicine_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    med_name = models.CharField(max_length=20)
    company_name = models.CharField(max_length=20)
    generic_name = models.CharField(max_length=20)

    status = models.CharField(
        max_length=20,
        choices=MedicineStatus.choices,
        default=MedicineStatus.ACTIVE
    )

    class Meta:
        db_table = "medicines"
        ordering = ["med_name"]

    def clean(self):

        errors = {}

        if self.medicine_code:
            self.medicine_code = self.medicine_code.strip().upper()

        if self.pk and not self.medicine_code:
            errors["medicine_code"] = "Medicine code cannot be empty."

        # ── Medicine Name: letters + spaces ONLY (no numbers), 2–20 chars, max 3 consecutive
        if self.med_name is not None:
            self.med_name = self.med_name.strip()
        if not self.med_name:
            errors["med_name"] = "Medicine name is required."
        elif "  " in self.med_name:
            errors["med_name"] = "Medicine name cannot contain multiple consecutive spaces."
        elif len(self.med_name) < 2:
            errors["med_name"] = "Medicine name must be at least 2 characters."
        elif len(self.med_name) > 20:
            errors["med_name"] = "Medicine name must not exceed 20 characters."
        elif not re.match(r'^[A-Za-z ]+$', self.med_name):
            errors["med_name"] = "Medicine name should contain only letters."
        elif _has_excessive_consecutive(self.med_name.replace(" ", ""), max_repeat=3):
            errors["med_name"] = "Medicine name: same character cannot be repeated more than 3 times consecutively."

        # ── Company Name: letters + spaces only, 2–20 chars, max 3 consecutive
        if self.company_name is not None:
            self.company_name = self.company_name.strip()
        err = _validate_name_field(self.company_name, "Company name", min_len=2, max_len=20, allow_numbers=False)
        if err:
            errors["company_name"] = err

        # ── Generic Name: same rules as company name
        if self.generic_name is not None:
            self.generic_name = self.generic_name.strip()
        err = _validate_name_field(self.generic_name, "Generic name", min_len=2, max_len=20, allow_numbers=False)
        if err:
            errors["generic_name"] = err

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        with transaction.atomic():

            self.full_clean()
            super().save(*args, **kwargs)

            if is_new and not self.medicine_code:
                self.medicine_code = f"MED{str(self.pk).zfill(6)}"
                super().save(update_fields=["medicine_code"])

    def __str__(self):
        return f"{self.medicine_code} - {self.med_name}"


# =========================================================
# MEDICINE DOSAGE
# =========================================================

DOSAGE_VALUE_RE = re.compile(r'^\d+(\.\d+)?(mg|mcg|g|ml|%|IU|units?)$', re.IGNORECASE)


class MedicineDosage(BaseModel):
    """
    Stores the allowed dosage strengths for a specific medicine.
    One Medicine → many MedicineDosage rows (e.g. Paracetamol → 500mg, 650mg, 1000mg).
    The pharmacist manages these via the admin/pharmacy module.
    The doctor's prescription form reads them and renders a per-medicine dropdown.
    """

    dosage_id = models.AutoField(primary_key=True)

    medicine = models.ForeignKey(
        "pharmacist.Medicine",
        on_delete=models.CASCADE,
        related_name="dosages"
    )

    dosage_value = models.CharField(
        max_length=20,
        help_text="e.g. 500mg, 10mcg, 5ml"
    )

    class Meta:
        db_table = "medicine_dosages"
        ordering = ["dosage_value"]
        constraints = [
            models.UniqueConstraint(
                fields=["medicine", "dosage_value"],
                condition=Q(is_deleted=False),
                name="pharmacist_medicinedosage_unique_per_medicine"
            )
        ]

    def clean(self):
        v = (self.dosage_value or "").strip()
        if not v:
            raise ValidationError({"dosage_value": "Dosage value is required."})
        if len(v) > 20:
            raise ValidationError({"dosage_value": "Dosage value must not exceed 20 characters."})
        if not DOSAGE_VALUE_RE.match(v):
            raise ValidationError({
                "dosage_value": (
                    "Invalid format. Examples: 5mg, 500mg, 10mcg, 5ml, 1g, 10IU. "
                    "Must start with a number followed by a unit."
                )
            })
        self.dosage_value = v

    def __str__(self):
        return f"{self.medicine.med_name} — {self.dosage_value}"


# =========================================================
# MEDICINE INVENTORY
# =========================================================

class InventoryStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    OUT_OF_STOCK = "OUT_OF_STOCK", "Out of Stock"
    EXPIRED = "EXPIRED", "Expired"


class MedicineInventory(BaseModel):

    inventory_id = models.AutoField(primary_key=True)

    medicine = models.ForeignKey(
        "pharmacist.Medicine",
        on_delete=models.PROTECT,
        related_name="inventory_batches"
    )

    batch_number = models.CharField(max_length=50, blank=True, editable=False)
    supplier_name = models.CharField(max_length=20)

    purchased_date = models.DateField()
    expiry_date = models.DateField()

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(10)]
    )

    quantity_available = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE
    )

    @staticmethod
    def _next_batch_number():
        """Generate the next sequential batch number: BT000001, BT000002, …"""
        last = (
            MedicineInventory.all_objects
            .filter(batch_number__regex=r'^BT\d{6}$')
            .order_by('-batch_number')
            .values_list('batch_number', flat=True)
            .first()
        )
        if last:
            return f"BT{int(last[2:]) + 1:06d}"
        return "BT000001"

    @staticmethod
    def get_fifo_batch(medicine):

        return (
            MedicineInventory.objects
            .filter(
                medicine=medicine,
                status=InventoryStatus.AVAILABLE,
                expiry_date__gte=timezone.now().date(),
                is_deleted=False
            )
            .order_by("expiry_date", "purchased_date")
            .first()
        )

    class Meta:
        db_table = "medicine_inventory"
        ordering = ["-expiry_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["medicine", "batch_number"],
                condition=Q(is_deleted=False),
                name="unique_medicine_batch"
            )
        ]

    def clean(self):

        errors = {}

        # ── Supplier Name: required, letters + spaces, 3–20 chars, max 3 consecutive
        if self.supplier_name is not None:
            self.supplier_name = self.supplier_name.strip()
        err = _validate_name_field(
            self.supplier_name, "Supplier name",
            min_len=3, max_len=20, allow_numbers=False
        )
        if err:
            errors["supplier_name"] = err

        # ── Unit Price: 10–1000
        if self.unit_price is not None:
            try:
                price = float(self.unit_price)
                if price < 10:
                    errors["unit_price"] = "Unit price must be at least ₹10."
                elif price > 1000:
                    errors["unit_price"] = "Unit price must not exceed ₹1,000."
            except (TypeError, ValueError):
                errors["unit_price"] = "Unit price must be a valid number."

        # ── Quantity validation
        # Min-5 rule applies only at CREATION (new batch entry).
        # During dispensing, stock is deducted below 5 legitimately — do NOT block that.
        # We only ever forbid negative values on existing records.
        if isinstance(self.quantity_available, int):
            if self.quantity_available < 0:
                errors["quantity_available"] = "Quantity cannot be negative."
            elif self.quantity_available > 500:
                errors["quantity_available"] = "Quantity must not exceed 500."
            elif self.pk is None and self.quantity_available < 5:
                # Enforce minimum of 5 only when creating a new batch
                errors["quantity_available"] = "Quantity must be at least 5."

        # ── Date cross-check
        if self.expiry_date and self.purchased_date:
            if self.expiry_date <= self.purchased_date:
                errors["expiry_date"] = "Expiry date must be after purchase date."

        today = timezone.now().date()

        # ── Expiry must be at least 6 months from today (new batches only)
        if self.pk is None and self.expiry_date:
            try:
                from dateutil.relativedelta import relativedelta
                min_expiry = today + relativedelta(months=6)
            except ImportError:
                from datetime import timedelta
                min_expiry = today + timedelta(days=183)
            if self.expiry_date < min_expiry:
                errors["expiry_date"] = "Expiry date must be at least 6 months from today."

        if self.expiry_date and self.expiry_date < today:
            self.status = InventoryStatus.EXPIRED

        elif isinstance(self.quantity_available, int) and self.quantity_available == 0:
            self.status = InventoryStatus.OUT_OF_STOCK

        else:
            self.status = InventoryStatus.AVAILABLE

        if errors:
            raise ValidationError(errors)

    def update_stock_status(self):

        today = timezone.now().date()

        if self.expiry_date and self.expiry_date < today:
            self.status = InventoryStatus.EXPIRED

        elif self.quantity_available == 0:
            self.status = InventoryStatus.OUT_OF_STOCK

        else:
            self.status = InventoryStatus.AVAILABLE

        self.save(update_fields=["status", "updated_at"])

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        with transaction.atomic():

            # Auto-generate batch number for new records
            if is_new and not self.batch_number:
                self.batch_number = MedicineInventory._next_batch_number()

            # Skip full_clean for F() / CombinedExpression quantity updates
            if not isinstance(self.quantity_available, (F, CombinedExpression)):
                self.full_clean()

            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.medicine.med_name} - Batch {self.batch_number}"


# =========================================================
# PHARMACY BILL
# =========================================================

class PharmacyBillStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PAID = "PAID", "Paid"
    CANCELLED = "CANCELLED", "Cancelled"


class PharmacyBill(BaseModel):

    pharmacy_bill_id = models.AutoField(primary_key=True)

    pharmacy_bill_code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        editable=False
    )

    prescription = models.OneToOneField(
        "doctor.Prescription",
        on_delete=models.PROTECT,
        related_name="pharmacy_bill"
    )

    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0
    )

    status = models.CharField(
        max_length=20,
        choices=PharmacyBillStatus.choices,
        default=PharmacyBillStatus.PENDING
    )

    # Set automatically when bill status transitions to PAID
    paid_at = models.DateTimeField(null=True, blank=True)

    @property
    def item_count(self):
        return self.items.filter(is_deleted=False).count()

    @property
    def tax_amount(self):
        return self.total_amount * 0.10

    class Meta:
        db_table = "pharmacy_bills"
        ordering = ["-created_at"]

    def clean(self):

        errors = {}

        if self.total_amount is not None and self.total_amount < 0:
            errors["total_amount"] = "Total amount cannot be negative."

        if self.prescription and self.prescription.status == PrescriptionStatus.CANCELLED:
            errors["prescription"] = "Cannot generate bill for cancelled prescription."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):

        is_new = self.pk is None

        with transaction.atomic():

            self.full_clean()
            super().save(*args, **kwargs)

            if is_new and not self.pharmacy_bill_code:
                self.pharmacy_bill_code = f"PB{str(self.pharmacy_bill_id).zfill(6)}"
                super().save(update_fields=["pharmacy_bill_code"])

    def recalculate_total(self):

        total = self.items.aggregate(
            total=Sum("total_price")
        )["total"] or 0

        self.total_amount = total
        self.save(update_fields=["total_amount", "updated_at"])

    def __str__(self):
        return f"{self.pharmacy_bill_code} - {self.status}"


# =========================================================
# PHARMACY BILL ITEMS
# =========================================================

class PharmacyBillItem(BaseModel):

    pharmacy_bill_item_id = models.AutoField(primary_key=True)

    pharmacy_bill = models.ForeignKey(
        "pharmacist.PharmacyBill",
        on_delete=models.PROTECT,
        related_name="items"
    )

    inventory = models.ForeignKey(
        "pharmacist.MedicineInventory",
        on_delete=models.PROTECT,
        related_name="bill_items"
    )

    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)


    class Meta:
        db_table = "pharmacy_bill_items"
        ordering = ["-created_at"]

    def clean(self):

        errors = {}

        if self.pk and self.pharmacy_bill.status == PharmacyBillStatus.PAID:
            return

        if self.pharmacy_bill and self.pharmacy_bill.status == PharmacyBillStatus.CANCELLED:
            raise ValidationError("Cannot modify items of a cancelled bill.")

        if self.inventory:

            if self.inventory.status in [
                InventoryStatus.EXPIRED,
                InventoryStatus.OUT_OF_STOCK
            ]:
                errors["inventory"] = "Cannot sell expired or out-of-stock inventory."

            if self.inventory.medicine.status == MedicineStatus.INACTIVE:
                errors["inventory"] = "Cannot sell inactive medicine."

        if (
            self.quantity is not None
            and self.unit_price is not None
        ):
            self.total_price = self.quantity * self.unit_price

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):

        self.full_clean()

        with transaction.atomic():

            inventory = MedicineInventory.objects.select_for_update().get(
                pk=self.inventory.pk
            )
            self.unit_price = inventory.unit_price

            self.full_clean()

            PharmacyBill.objects.select_for_update().get(
                pk=self.pharmacy_bill.pk
            )
            if inventory.status in [
                InventoryStatus.EXPIRED,
                InventoryStatus.OUT_OF_STOCK
            ]:
                raise ValidationError(
                    "Cannot sell expired or out-of-stock inventory."
                )

            if not self.pk:

                if self.quantity > inventory.quantity_available:
                    raise ValidationError("Insufficient inventory quantity.")

                inventory.quantity_available = inventory.quantity_available - self.quantity
                inventory.save()

                inventory.refresh_from_db()
                inventory.update_stock_status()

            else:

                old_item = PharmacyBillItem.objects.select_for_update().get(
                    pk=self.pk
                )

                if old_item.pharmacy_bill_id != self.pharmacy_bill_id:
                    raise ValidationError(
                        "Bill cannot be changed after item creation."
                    )

                quantity_diff = self.quantity - old_item.quantity

                if quantity_diff > 0:

                    if quantity_diff > inventory.quantity_available:
                        raise ValidationError(
                            "Insufficient inventory quantity."
                        )

                    inventory.quantity_available = inventory.quantity_available - quantity_diff

                elif quantity_diff < 0:

                    inventory.quantity_available = inventory.quantity_available + abs(quantity_diff)

                inventory.save()

                inventory.refresh_from_db()
                inventory.update_stock_status()

            self.total_price = self.quantity * self.unit_price

            super().save(*args, **kwargs)

            self.pharmacy_bill.recalculate_total()

    def delete(self, *args, **kwargs):

        with transaction.atomic():

            inventory = MedicineInventory.objects.select_for_update().get(
                pk=self.inventory.pk
            )

            inventory.quantity_available = F("quantity_available") + self.quantity
            inventory.save()

            inventory.refresh_from_db()
            inventory.update_stock_status()

            bill = self.pharmacy_bill

            self.is_deleted = True
            super().save(update_fields=["is_deleted", "updated_at"])

            bill.recalculate_total()

    def __str__(self):
        return f"{self.pharmacy_bill.pharmacy_bill_code} - {self.inventory.batch_number}"

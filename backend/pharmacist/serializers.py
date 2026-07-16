import re
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction

from .models import (
    Medicine,
    MedicineDosage,
    MedicineInventory,
    PharmacyBill,
    PharmacyBillItem,
    MedicineStatus,
    InventoryStatus,
    PharmacyBillStatus
)

from doctor.models import PrescriptionStatus


# =========================
# SHARED VALIDATION HELPERS
# =========================

def _check_consecutive(value, field_label, max_repeat=3):
    """Raise ValidationError if a character repeats more than max_repeat times."""
    if re.search(r'(.)\1{' + str(max_repeat) + r',}', value.replace(" ", "")):
        raise serializers.ValidationError(
            f"{field_label}: same character cannot be repeated more than {max_repeat} times consecutively."
        )


def _validate_letters_spaces(value, field_label, min_len=2, max_len=20):
    """Letters + spaces only, no whitespace-only, no multiple spaces, consecutive check."""
    v = value.strip() if value else ""
    if not v:
        raise serializers.ValidationError(f"{field_label} is required.")
    if "  " in v:
        raise serializers.ValidationError(f"{field_label} cannot contain multiple consecutive spaces.")
    if len(v) < min_len:
        raise serializers.ValidationError(f"{field_label} must be at least {min_len} characters.")
    if len(v) > max_len:
        raise serializers.ValidationError(f"{field_label} must not exceed {max_len} characters.")
    if not re.match(r'^[A-Za-z ]+$', v):
        raise serializers.ValidationError(f"{field_label} may only contain letters and spaces.")
    _check_consecutive(v, field_label)
    return v



# =========================
# BASE SERIALIZER
# =========================
class EnterpriseModelSerializer(serializers.ModelSerializer):

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
                {"database_error": "A database constraint was violated."}
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
                {"database_error": "A database constraint was violated."}
            )


# =========================
# MEDICINE DOSAGE
# =========================
class MedicineDosageSerializer(EnterpriseModelSerializer):
    """
    Serializes a single dosage strength for a medicine.
    Used both for CRUD (pharmacist) and as a nested read-only list on MedicineSerializer.
    """

    class Meta:
        model = MedicineDosage
        fields = [
            "dosage_id",
            "medicine",
            "dosage_value",
            "created_at",
        ]
        read_only_fields = ["dosage_id", "created_at"]

    def validate_dosage_value(self, value):
        import re
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Dosage value is required.")
        if len(v) > 20:
            raise serializers.ValidationError("Dosage value must not exceed 20 characters.")
        pattern = re.compile(r'^\d+(\.\d+)?(mg|mcg|g|ml|%|IU|units?)$', re.IGNORECASE)
        if not pattern.match(v):
            raise serializers.ValidationError(
                "Invalid format. Examples: 5mg, 500mg, 10mcg, 5ml, 1g, 10IU. "
                "Must start with a number followed by a unit."
            )
        return v

    def validate(self, attrs):
        medicine = attrs.get("medicine") or (self.instance.medicine if self.instance else None)
        dosage_value = attrs.get("dosage_value") or (self.instance.dosage_value if self.instance else None)

        if medicine and dosage_value:
            qs = MedicineDosage.objects.filter(
                medicine=medicine,
                dosage_value__iexact=dosage_value,
                is_deleted=False,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"dosage_value": f"{dosage_value} is already defined for this medicine."}
                )
        return attrs


# =========================
# MEDICINE
# =========================
class MedicineSerializer(EnterpriseModelSerializer):
    # Nested read-only list of dosage strengths for this medicine.
    # Written separately via the /medicine-dosages/ endpoint.
    dosage_options = MedicineDosageSerializer(source="dosages", many=True, read_only=True)

    class Meta:
        model = Medicine
        fields = [
            "med_id",
            "medicine_code",
            "med_name",
            "company_name",
            "generic_name",
            "status",
            "dosage_options",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "med_id",
            "medicine_code",
            "dosage_options",
            "created_at",
            "updated_at",
        ]

    def validate_med_name(self, value):
        """Medicine name: letters + spaces ONLY (no numbers), 2–20 chars, max 3 consecutive."""
        v = value.strip() if value else ""
        if not v:
            raise serializers.ValidationError("Medicine name is required.")
        if "  " in v:
            raise serializers.ValidationError("Medicine name cannot contain multiple consecutive spaces.")
        if len(v) < 2:
            raise serializers.ValidationError("Medicine name must be at least 2 characters.")
        if len(v) > 20:
            raise serializers.ValidationError("Medicine name must not exceed 20 characters.")
        if not re.match(r'^[A-Za-z ]+$', v):
            raise serializers.ValidationError("Medicine name should contain only letters.")
        _check_consecutive(v, "Medicine name")
        return v

    def validate_company_name(self, value):
        """Company name: letters + spaces only, 2–20 chars, max 3 consecutive."""
        return _validate_letters_spaces(value, "Company name", min_len=2, max_len=20)

    def validate_generic_name(self, value):
        """Generic name: letters + spaces only, 2–20 chars, max 3 consecutive."""
        return _validate_letters_spaces(value, "Generic name", min_len=2, max_len=20)

    def validate_status(self, value):

        if self.instance and self.instance.status == MedicineStatus.INACTIVE \
                and value == MedicineStatus.ACTIVE:
            raise serializers.ValidationError(
                "Inactive medicines cannot be reactivated."
            )

        return value


# =========================
# INVENTORY
# =========================
class MedicineInventorySerializer(EnterpriseModelSerializer):

    medicine_name = serializers.CharField(source="medicine.med_name", read_only=True)

    class Meta:
        model = MedicineInventory
        fields = [
            "inventory_id",
            "medicine",
            "medicine_name",
            "batch_number",
            "supplier_name",
            "purchased_date",
            "expiry_date",
            "unit_price",
            "quantity_available",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "inventory_id",
            "medicine_name",
            "batch_number",       # Auto-generated — never user-submitted
            "status",
            "created_at",
            "updated_at",
        ]

    def validate_supplier_name(self, value):
        """Supplier name: required, letters + spaces only, 3–20 chars, max 3 consecutive."""
        return _validate_letters_spaces(value, "Supplier name", min_len=3, max_len=20)

    def validate_unit_price(self, value):
        """Unit price: 10–1000."""
        try:
            price = float(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Unit price must be a valid number.")
        if price < 10:
            raise serializers.ValidationError("Unit price must be at least ₹10.")
        if price > 1000:
            raise serializers.ValidationError("Unit price must not exceed ₹1,000.")
        return value

    def validate_quantity_available(self, value):
        """Quantity: 5–500."""
        if value < 5:
            raise serializers.ValidationError("Quantity must be at least 5.")
        if value > 500:
            raise serializers.ValidationError("Quantity must not exceed 500.")
        return value

    def validate(self, attrs):
        from datetime import date
        try:
            from dateutil.relativedelta import relativedelta
            _has_relativedelta = True
        except ImportError:
            _has_relativedelta = False

        expiry = attrs.get("expiry_date") or (self.instance.expiry_date if self.instance else None)
        purchase = attrs.get("purchased_date") or (self.instance.purchased_date if self.instance else None)
        medicine = attrs.get("medicine") or (self.instance.medicine if self.instance else None)

        if expiry and purchase and expiry <= purchase:
            raise serializers.ValidationError(
                {"expiry_date": "Expiry date must be after purchase date."}
            )

        # ── Expiry ≥ 6 months from today (enforce only when creating a new batch)
        if not self.instance and expiry:
            today = date.today()
            if _has_relativedelta:
                from dateutil.relativedelta import relativedelta
                min_expiry = today + relativedelta(months=6)
            else:
                # Fallback: approximate 6 months as 183 days
                from datetime import timedelta
                min_expiry = today + timedelta(days=183)
            if expiry < min_expiry:
                raise serializers.ValidationError(
                    {"expiry_date": "Expiry date must be at least 6 months from today."}
                )

        if medicine and medicine.status == MedicineStatus.INACTIVE:
            raise serializers.ValidationError(
                {"medicine": "Cannot add inventory for inactive medicine."}
            )

        return attrs


# =========================
# BILL ITEM
# =========================
class PharmacyBillItemSerializer(EnterpriseModelSerializer):

    medicine_name = serializers.CharField(
        source="inventory.medicine.med_name", read_only=True
    )

    class Meta:
        model = PharmacyBillItem
        fields = [
            "pharmacy_bill_item_id",
            "pharmacy_bill",
            "inventory",
            "medicine_name",
            "quantity",
            "unit_price",
            "total_price",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "pharmacy_bill_item_id",
            "created_at",
            "updated_at",
            "total_price",
        ]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )
        return value

    def validate(self, attrs):

        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        inventory = attrs.get("inventory", getattr(self.instance, "inventory", None))
        bill = attrs.get("pharmacy_bill", getattr(self.instance, "pharmacy_bill", None))

        if not inventory:
            raise serializers.ValidationError(
                {"inventory": "Inventory batch is required."}
            )

        if inventory.status in [
            InventoryStatus.EXPIRED,
            InventoryStatus.OUT_OF_STOCK
        ]:
            raise serializers.ValidationError(
                {"inventory": "Cannot sell expired or out-of-stock inventory."}
            )

        if inventory.medicine.status == MedicineStatus.INACTIVE:
            raise serializers.ValidationError(
                {"inventory": "Cannot sell inactive medicine."}
            )

        if self.instance and "pharmacy_bill" in attrs:
            if attrs["pharmacy_bill"] != self.instance.pharmacy_bill:
                raise serializers.ValidationError(
                    {"pharmacy_bill": "Bill cannot be changed after item creation."}
                )

        if bill and bill.status in [
            PharmacyBillStatus.PAID,
            PharmacyBillStatus.CANCELLED
        ]:
            raise serializers.ValidationError(
                "Cannot modify items of a closed bill."
            )

        # Stock check
        if inventory and quantity is not None:

            available_stock = inventory.quantity_available

            if self.instance:
                available_stock += self.instance.quantity

            if quantity > available_stock:
                raise serializers.ValidationError(
                    {"quantity": "Requested quantity exceeds available inventory."}
                )

        # Auto total price
        if quantity and inventory:
            attrs["unit_price"] = inventory.unit_price
            attrs["total_price"] = quantity * inventory.unit_price

        return attrs


# =========================
# BILL
# =========================
class PharmacyBillSerializer(EnterpriseModelSerializer):

    items = PharmacyBillItemSerializer(many=True, read_only=True)

    patient_name = serializers.CharField(
        source="prescription.appointment.patient.full_name",
        read_only=True
    )
    paid_at_ist = serializers.SerializerMethodField()

    class Meta:
        model = PharmacyBill
        fields = [
            "pharmacy_bill_id",
            "pharmacy_bill_code",
            "prescription",
            "status",
            "total_amount",
            "paid_at",
            "paid_at_ist",
            "items",
            "patient_name",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "pharmacy_bill_id",
            "pharmacy_bill_code",
            "total_amount",
            "paid_at",
            "paid_at_ist",
            "created_at",
            "updated_at",
        ]

    def get_paid_at_ist(self, obj):
        if not obj.paid_at:
            return None
        import pytz
        IST = pytz.timezone("Asia/Kolkata")
        return obj.paid_at.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")

    def validate_status(self, value):

        if self.instance:

            if self.instance.status == PharmacyBillStatus.PAID:
                raise serializers.ValidationError(
                    "Paid bill cannot be modified."
                )

            if self.instance.status == PharmacyBillStatus.CANCELLED:
                raise serializers.ValidationError(
                    "Cancelled bill cannot be modified."
                )

            if value == PharmacyBillStatus.PAID:
                if not self.instance.items.filter(is_deleted=False).exists():
                    raise serializers.ValidationError(
                        "Cannot mark bill as Paid: medicines have not been dispensed yet."
                    )
                if self.instance.total_amount <= 0:
                    raise serializers.ValidationError(
                        "Cannot mark bill as Paid: bill amount must be greater than zero."
                    )

        return value

    def validate(self, attrs):

        prescription = attrs.get("prescription") or getattr(self.instance, "prescription", None)

        if prescription and prescription.status == PrescriptionStatus.CANCELLED:
            raise serializers.ValidationError(
                {"prescription": "Cannot create bill for cancelled prescription."}
            )

        if self.instance and "prescription" in attrs:
            if attrs["prescription"] != self.instance.prescription:
                raise serializers.ValidationError(
                    {"prescription": "Prescription cannot be changed after bill creation."}
                )

        if prescription and not self.instance:
            if PharmacyBill.objects.filter(
                prescription=prescription,
                is_deleted=False
            ).exists():
                raise serializers.ValidationError(
                    {"prescription": "A bill already exists for this prescription."}
                )

        return attrs

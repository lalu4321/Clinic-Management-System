from django.contrib import admin
from django.core.exceptions import ValidationError
from .models import Medicine, MedicineInventory, PharmacyBill, PharmacyBillItem


# =========================
# MEDICINE
# =========================
@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ("med_id", "med_name", "company_name", "status")
    search_fields = ("med_name", "medicine_code", "generic_name")


# =========================
# INVENTORY
# =========================
@admin.register(MedicineInventory)
class MedicineInventoryAdmin(admin.ModelAdmin):
    list_display = (
        "inventory_id",
        "medicine",
        "batch_number",
        "quantity_available",
        "expiry_date",
        "status"
    )
    search_fields = ("batch_number", "medicine__med_name")
    list_filter = ("status", "expiry_date")


# =========================
# BILL ITEM (DIRECT ADD PAGE)
# =========================
@admin.register(PharmacyBillItem)
class PharmacyBillItemAdmin(admin.ModelAdmin):

    list_display = (
        "pharmacy_bill_item_id",
        "pharmacy_bill",
        "inventory",
        "quantity",
        "unit_price",
        "total_price"
    )

    # ONLY SUPERUSER CAN ADD
    def has_add_permission(self, request):
        return request.user.is_superuser

    # ONLY SUPERUSER CAN EDIT
    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def save_model(self, request, obj, form, change):

        if not change:  # only when creating

            inventory = obj.inventory

            if inventory.quantity_available < obj.quantity:
                raise ValidationError("Not enough stock available")

            # NORMAL subtraction (NO F())
            inventory.quantity_available -= obj.quantity
            inventory.save()

            # AUTO PRICE
            obj.unit_price = inventory.unit_price
            obj.total_price = obj.quantity * inventory.unit_price

        super().save_model(request, obj, form, change)


# =========================
# BILL ITEM INLINE (🔥 FIXED)
# =========================
class PharmacyBillItemInline(admin.TabularInline):
    model = PharmacyBillItem
    extra = 1  # 👈 important (shows empty row)
    autocomplete_fields = ['inventory']  # 👈 dropdown works now
    readonly_fields = ("unit_price", "total_price")  # 👈 only these readonly


# =========================
# BILL
# =========================
@admin.register(PharmacyBill)
class PharmacyBillAdmin(admin.ModelAdmin):
    list_display = (
        "pharmacy_bill_id",
        "prescription",
        "status",
        "total_amount",
        "created_at"
    )
    inlines = [PharmacyBillItemInline]
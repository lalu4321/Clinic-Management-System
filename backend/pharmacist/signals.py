from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import MedicineInventory


@receiver(post_save, sender=MedicineInventory)
def update_inventory_status(sender, instance, update_fields=None, **kwargs):

    if update_fields and "status" in update_fields:
        return

    instance.update_stock_status()
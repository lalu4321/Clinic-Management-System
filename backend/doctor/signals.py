from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
import logging

from .models import Prescription, LabTestRequest
from pharmacist.models import PharmacyBill

logger = logging.getLogger('email_service')


# ─────────────────────────────────────────────────────────────────────────────
# PRESCRIPTION → auto-create PharmacyBill (existing, unchanged)
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender=Prescription)
def create_pharmacy_bill(sender, instance, created, **kwargs):

    if not created:
        return

    def create_bill():
        if PharmacyBill.objects.filter(
            prescription=instance,
            is_deleted=False
        ).exists():
            return
        PharmacyBill.objects.create(
            prescription=instance,
            total_amount=0
        )

    transaction.on_commit(create_bill)


# ─────────────────────────────────────────────────────────────────────────────
# TRIGGER 2: LabTestRequest created → notify all Lab Technicians
# ─────────────────────────────────────────────────────────────────────────────

@receiver(post_save, sender=LabTestRequest)
def notify_lab_technicians_on_new_request(sender, instance, created, **kwargs):
    """
    When a doctor places a new lab test request, notify all active lab
    technicians by email so they can prepare for processing.

    Uses transaction.on_commit so the email fires only after the row is
    durably committed — safe even when the caller is inside a nested atomic.
    """
    if not created:
        return

    request_id = instance.pk

    def send_notification():
        try:
            from common.email_service import EmailService
            from doctor.models import LabTestRequest as LTR
            req = LTR.objects.select_related(
                'appointment__patient',
                'appointment__doctor__staff__user',
                'lab_test',
            ).get(pk=request_id)
            EmailService.send_lab_test_request_notification(req)
        except Exception as exc:
            logger.error(f"[EMAIL] Lab test request notification failed: {exc}")

    transaction.on_commit(send_notification)
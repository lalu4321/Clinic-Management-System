from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone
import logging

from doctor.models import LabTestRequest, LabRequestStatus
from .models import LabBill, LabBillItem

logger = logging.getLogger('email_service')


@receiver(post_save, sender=LabTestRequest)
def create_lab_bill(sender, instance, created, **kwargs):
    """
    Create one LabBill per appointment the first time a lab request is raised
    for that appointment.  Subsequent requests on the same appointment reuse
    the existing bill (all tests from the same appointment share one bill).

    TRIGGER 4: When a new bill is created, schedule a notification to the
    patient (if they have an email) and all active receptionists.
    """
    if not created:
        return

    appointment = instance.appointment

    with transaction.atomic():
        # Appointment-scoped uniqueness check — never mix data across appointments
        existing = LabBill.objects.select_for_update().filter(
            appointment=appointment,
            is_deleted=False,
        ).first()

        if existing:
            return  # Bill already exists for this appointment

        bill = LabBill.objects.create(
            patient=appointment.patient,
            appointment=appointment,
        )

        # ── Trigger 4: notify patient + receptionists after commit ────────
        bill_id = bill.lab_bill_id

        def send_bill_created_emails():
            try:
                from common.email_service import EmailService
                from labtechinician.models import LabBill as LB
                b = LB.objects.select_related(
                    'patient', 'appointment'
                ).get(pk=bill_id)
                EmailService.send_lab_bill_generated_notification(b)
            except Exception as exc:
                logger.error(f"[EMAIL] Lab bill generated notification failed: {exc}")

        transaction.on_commit(send_bill_created_emails)


@receiver(post_save, sender=LabTestRequest)
def generate_bill_item_on_completion(sender, instance, created, **kwargs):
    """
    When a LabTestRequest is marked COMPLETED, immediately generate a
    LabBillItem for it on the appointment's PENDING bill and recalculate
    the running total.  This ensures the total is visible BEFORE payment
    and is never ₹0 when items exist.

    Appointment-scoped: uses appointment FK, never patient alone.
    """
    if created:
        return  # Handled by create_lab_bill above; items not generated at creation

    if instance.status != LabRequestStatus.COMPLETED:
        return  # Only act when a test is freshly completed

    if instance.is_deleted:
        return

    appointment = instance.appointment

    with transaction.atomic():
        bill = LabBill.objects.select_for_update().filter(
            appointment=appointment,
            is_deleted=False,
        ).first()

        if not bill:
            return

        if bill.status in (LabBill.Status.PAID, LabBill.Status.CANCELLED):
            return  # Paid and cancelled bills are both immutable

        # Idempotent: get_or_create prevents duplicates on retries
        LabBillItem.objects.get_or_create(
            lab_bill=bill,
            test_catalog=instance.lab_test,
            defaults={
                "quantity": 1,
                "unit_price": instance.lab_test.test_charge,
            },
        )

        bill.recalculate_total()


@receiver(post_save, sender=LabTestRequest)
def cancel_lab_bill_when_all_requests_cancelled(sender, instance, created, **kwargs):
    """
    When a LabTestRequest is cancelled (or soft-deleted), check whether ALL
    remaining active requests for the same appointment are now cancelled.
    If so, auto-cancel the appointment's PENDING LabBill so that:
      - It disappears from the "Pending" billing queue.
      - No payment can be attempted against it.
      - The lab tech cannot generate items for it.

    ENFORCEMENT RULES:
      - PAID bills are never touched (payment is final).
      - Already-CANCELLED bills are skipped (idempotent).
      - Only fires when the triggering request is CANCELLED or soft-deleted.
    """
    if created:
        return  # Brand-new requests never trigger cancellation

    # Only act when this specific request was just cancelled or deleted
    if instance.status != LabRequestStatus.CANCELLED and not instance.is_deleted:
        return

    appointment = instance.appointment

    with transaction.atomic():
        bill = LabBill.objects.select_for_update().filter(
            appointment=appointment,
            is_deleted=False,
        ).first()

        if not bill:
            return  # No bill exists — nothing to cancel

        if bill.status in (LabBill.Status.PAID, LabBill.Status.CANCELLED):
            return  # Paid bills are immutable; already-cancelled bills need no action

        # Are there any requests still alive (not cancelled, not deleted)?
        any_active = LabTestRequest.objects.filter(
            appointment=appointment,
            is_deleted=False,
        ).exclude(
            status=LabRequestStatus.CANCELLED
        ).exists()

        if any_active:
            return  # At least one request is still valid — leave the bill as-is

        # Every request for this appointment has been cancelled.
        # Mark the bill CANCELLED so it is removed from the billing queue.
        LabBill.objects.filter(pk=bill.pk).update(
            status=LabBill.Status.CANCELLED,
            version=bill.version + 1,
            updated_at=timezone.now(),
        )
        logger.info(
            f"[LAB BILL] Bill {bill.lab_bill_code} auto-cancelled — "
            f"all requests for appointment {appointment.appointment_code} are cancelled."
        )

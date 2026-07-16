from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("labtechinician", "0004_refactor_parameter_and_result"),
        ("reception", "0001_initial"),
    ]

    operations = [
        # 1. Add appointment FK (nullable for backward compat with existing bills)
        migrations.AddField(
            model_name="labbill",
            name="appointment",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="lab_bill",
                to="reception.appointment",
            ),
        ),
        # 2. Add paid_at timestamp (set when status → PAID)
        migrations.AddField(
            model_name="labbill",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # 3. Partial unique index: one non-deleted bill per appointment
        migrations.AddConstraint(
            model_name="labbill",
            constraint=models.UniqueConstraint(
                condition=models.Q(appointment__isnull=False, is_deleted=False),
                fields=["appointment"],
                name="unique_active_bill_per_appointment",
            ),
        ),
    ]

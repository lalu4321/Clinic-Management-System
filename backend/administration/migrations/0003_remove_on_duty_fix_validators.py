"""
Migration: Remove ON_DUTY from DoctorDutyStatus, fix salary and consultation_fee validators.

Steps:
  1. Data migration: update any ON_DUTY doctors → AVAILABLE
  2. Alter duty_status field choices (remove ON_DUTY)
  3. Alter salary validator: MinValueValidator(0) → MinValueValidator(1000)
  4. Alter consultation_fee validators: min 0/max 1_000_000 → min 100/max 5000
"""

from django.db import migrations, models
import django.core.validators


def migrate_on_duty_to_available(apps, schema_editor):
    """Set any ON_DUTY doctor to AVAILABLE before removing the choice."""
    DoctorProfile = apps.get_model("administration", "DoctorProfile")
    DoctorProfile.objects.filter(duty_status="ON_DUTY").update(duty_status="AVAILABLE")


class Migration(migrations.Migration):

    dependencies = [
        ("administration", "0002_add_status_enums"),
    ]

    operations = [
        # Step 1: Data migration — convert ON_DUTY → AVAILABLE
        migrations.RunPython(
            migrate_on_duty_to_available,
            reverse_code=migrations.RunPython.noop,
        ),

        # Step 2: Remove ON_DUTY from DoctorDutyStatus choices
        migrations.AlterField(
            model_name="doctorprofile",
            name="duty_status",
            field=models.CharField(
                choices=[
                    ("AVAILABLE", "Available"),
                    ("OFF_DUTY", "Off Duty"),
                ],
                db_index=True,
                default="AVAILABLE",
                help_text="Current duty status of the doctor",
                max_length=20,
            ),
        ),

        # Step 3: Update salary MinValueValidator 0 → 1000
        migrations.AlterField(
            model_name="staff",
            name="salary",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[
                    django.core.validators.MinValueValidator(1000),
                    django.core.validators.MaxValueValidator(1000000),
                ],
            ),
        ),

        # Step 4: Update consultation_fee validators min 0→100, max 1M→5000
        migrations.AlterField(
            model_name="doctorprofile",
            name="consultation_fee",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[
                    django.core.validators.MinValueValidator(100),
                    django.core.validators.MaxValueValidator(5000),
                ],
            ),
        ),
    ]

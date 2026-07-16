from django.db import migrations, models
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):
    """
    Increase the maximum allowed reference_max for LabTestParameter from 100 to 500.
    Only the validator annotation changes — no column DDL change is needed.
    """

    dependencies = [
        ("labtechinician", "0005_labbill_appointment_paid_at"),
    ]

    operations = [
        migrations.AlterField(
            model_name="labtestparameter",
            name="reference_max",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=10,
                null=True,
                validators=[django.core.validators.MaxValueValidator(Decimal("500"))],
            ),
        ),
    ]

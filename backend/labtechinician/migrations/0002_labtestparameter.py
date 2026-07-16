import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("labtechinician", "0001_initial"),
    ]

    operations = [
        # 1. Create LabTestParameter table
        migrations.CreateModel(
            name="LabTestParameter",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(db_index=True, default=False)),
                ("version", models.PositiveIntegerField(default=1)),
                (
                    "parameter_id",
                    models.AutoField(primary_key=True, serialize=False),
                ),
                ("parameter_name", models.CharField(max_length=15)),
                (
                    "reference_value",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        validators=[
                            django.core.validators.MinValueValidator(Decimal("0.01"))
                        ],
                    ),
                ),
                ("unit", models.CharField(blank=True, max_length=50, null=True)),
                (
                    "lab_test",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="parameters",
                        to="labtechinician.labtestcatalog",
                    ),
                ),
            ],
            options={
                "db_table": "lab_test_parameters",
            },
        ),
        # 2. Add unique constraint on (lab_test, parameter_name)
        migrations.AddConstraint(
            model_name="labtestparameter",
            constraint=models.UniqueConstraint(
                fields=["lab_test", "parameter_name"],
                name="unique_parameter_per_test",
            ),
        ),
        # 3. Reduce test_name max_length (SQLite: no-op at DB level; enforced by model.clean())
        migrations.AlterField(
            model_name="labtestcatalog",
            name="test_name",
            field=models.CharField(max_length=20, unique=True),
        ),
        # 4. Update test_charge validator to min=50
        migrations.AlterField(
            model_name="labtestcatalog",
            name="test_charge",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("50.00"))
                ],
            ),
        ),
        # 5. Reduce parameter_name in LabTestResult from 100 to 15
        migrations.AlterField(
            model_name="labtestresult",
            name="parameter_name",
            field=models.CharField(max_length=15),
        ),
    ]

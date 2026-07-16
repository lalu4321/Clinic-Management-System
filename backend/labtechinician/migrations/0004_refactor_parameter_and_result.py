import django.core.validators
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("labtechinician", "0003_alter_labbillitem_unit_price"),
    ]

    operations = [
        # 1. Add reference_min (nullable first so existing rows don't violate NOT NULL)
        migrations.AddField(
            model_name="labtestparameter",
            name="reference_min",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                null=True,
                blank=True,
                validators=[django.core.validators.MinValueValidator(Decimal("1"))],
            ),
        ),
        # 2. Add reference_max (nullable first)
        migrations.AddField(
            model_name="labtestparameter",
            name="reference_max",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                null=True,
                blank=True,
                validators=[django.core.validators.MaxValueValidator(Decimal("100"))],
            ),
        ),
        # 3. Data migration: seed reference_min/max from old reference_value
        migrations.RunSQL(
            sql=(
                "UPDATE lab_test_parameters "
                "SET reference_min = CASE WHEN reference_value >= 1 THEN reference_value ELSE 1 END, "
                "    reference_max = CASE WHEN reference_value < 100 THEN reference_value + 1 ELSE 100 END "
                "WHERE reference_value IS NOT NULL"
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        # 4. Remove old single reference_value field
        migrations.RemoveField(
            model_name="labtestparameter",
            name="reference_value",
        ),
        # 5. Fix existing null units before making unit required
        migrations.RunSQL(
            sql="UPDATE lab_test_parameters SET unit = '' WHERE unit IS NULL",
            reverse_sql=migrations.RunSQL.noop,
        ),
        # 6. Make unit non-nullable with default ''
        migrations.AlterField(
            model_name="labtestparameter",
            name="unit",
            field=models.CharField(max_length=50, default=""),
        ),
        # 7. Make result_value optional (auto-computed from numeric value)
        migrations.AlterField(
            model_name="labtestresult",
            name="result_value",
            field=models.CharField(max_length=255, blank=True, default=""),
        ),
    ]

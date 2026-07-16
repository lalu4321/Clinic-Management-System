from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """
    Add MedicineDosage table — per-medicine allowed dosage strengths.
    One Medicine → many MedicineDosage rows.
    """

    dependencies = [
        ("pharmacist", "0002_pharmacybill_paid_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="MedicineDosage",
            fields=[
                ("created_at",    models.DateTimeField(auto_now_add=True)),
                ("updated_at",    models.DateTimeField(auto_now=True)),
                ("is_deleted",    models.BooleanField(db_index=True, default=False)),
                ("version",       models.PositiveIntegerField(default=1)),
                ("dosage_id",     models.AutoField(primary_key=True, serialize=False)),
                ("dosage_value",  models.CharField(
                    max_length=20,
                    help_text="e.g. 500mg, 10mcg, 5ml"
                )),
                ("medicine",      models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="dosages",
                    to="pharmacist.medicine",
                )),
            ],
            options={
                "db_table": "medicine_dosages",
                "ordering": ["dosage_value"],
            },
        ),
        migrations.AddConstraint(
            model_name="medicinedosage",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_deleted=False),
                fields=["medicine", "dosage_value"],
                name="pharmacist_medicinedosage_unique_per_medicine",
            ),
        ),
        migrations.AddConstraint(
            model_name="medicinedosage",
            constraint=models.CheckConstraint(
                condition=models.Q(version__gt=0),
                name="pharmacist_medicinedosage_version_positive_check",
            ),
        ),
    ]

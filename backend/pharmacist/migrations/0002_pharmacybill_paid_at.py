from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add paid_at timestamp to PharmacyBill.
    Set automatically when bill status transitions to PAID.
    """

    dependencies = [
        ("pharmacist", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="pharmacybill",
            name="paid_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

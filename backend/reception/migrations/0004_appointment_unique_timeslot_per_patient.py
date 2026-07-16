from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add a partial unique constraint that prevents a patient from booking
    two appointments at the same date/time (across any doctor).

    This complements the existing unique_timeslot_per_doctor constraint and
    is enforced at the database level as a final safety net. Application-level
    checks in AppointmentSlotValidator and Appointment.clean() provide earlier,
    more descriptive errors.
    """

    dependencies = [
        ("reception", "0003_add_patient_status"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="appointment",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_deleted=False),
                fields=["patient", "appointment_date", "appointment_time"],
                name="unique_timeslot_per_patient",
            ),
        ),
    ]

from django.db import models, transaction, IntegrityError
from django.db.models import Q
from django.core.exceptions import ValidationError


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class BaseModel(models.Model):

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_deleted = models.BooleanField(default=False, db_index=True)

    version = models.PositiveIntegerField(default=1)

    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=Q(version__gt=0),
                name="%(app_label)s_%(class)s_version_positive_check"
            )
        ]

    def save(self, *args, **kwargs):
        try:
            self.full_clean()
            with transaction.atomic():
                super().save(*args, **kwargs)
        except ValidationError:
            raise
        except IntegrityError:
            raise ValidationError("Database integrity error occurred.")

    def delete(self, *args, **kwargs):
        if self.is_deleted:
            return

        with transaction.atomic():
            self.is_deleted = True
            self.version += 1
            super().save(update_fields=["is_deleted", "version", "updated_at"])
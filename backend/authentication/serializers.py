from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomTokenSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):

        data = super().validate(attrs)
        user = self.user

        # SECURITY
        if not user.is_active:
            raise serializers.ValidationError("User account is inactive.")

        # SAFE ACCESS
        staff = getattr(user, "staff_profile", None)

        if staff:
            if staff.is_deleted:
                raise serializers.ValidationError("Staff account has been removed.")

            if not staff.is_active:
                raise serializers.ValidationError("Staff account is inactive.")

        # EXTRA DATA
        role = user.groups.values_list("name", flat=True).first() if user.groups.exists() else None
        staff_id = staff.staff_id if staff else None

        data["role"] = role
        data["staff_id"] = staff_id
        data["username"] = user.username

        return data

    @classmethod
    def get_token(cls, user):

        token = super().get_token(user)

        role = None
        if user.groups.exists():
            role = user.groups.values_list(
                "name", flat=True
            ).first()

        staff_id = None
        if hasattr(user, "staff_profile") and user.staff_profile:
            staff_id = user.staff_profile.staff_id

        token["role"] = role
        token["staff_id"] = staff_id
        token["username"] = user.username

        return token
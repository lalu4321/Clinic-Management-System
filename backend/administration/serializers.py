import re
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db import IntegrityError
from datetime import date
from rest_framework import serializers


from administration.models import (
    Staff,
    DoctorProfile,
    Specialization,
    DoctorSchedule
)

User = get_user_model()


# =========================================================
# USER SERIALIZER (Nested for Staff Creation)
# =========================================================

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "password",
            "first_name",
            "last_name",
            "email",
            "is_active",
            "date_joined",
        )
        read_only_fields = ("id", "date_joined", "is_active")

    # ------------------------
    # USERNAME VALIDATION
    # ------------------------

    def validate_username(self, value):
        value = value.strip()

        if len(value) < 4 or len(value) > 7:
            raise serializers.ValidationError("Username must be between 4 and 7 characters.")

        if not re.match(r'^[A-Za-z.]+$', value):
            raise serializers.ValidationError(
                "Username may only contain letters (a-z, A-Z) and dots (.)."
            )

        # Must contain at least one letter (not dot-only)
        if not re.search(r'[A-Za-z]', value):
            raise serializers.ValidationError("Username must contain at least one letter.")

        # Reject dot at start or end
        if value.startswith('.') or value.endswith('.'):
            raise serializers.ValidationError("Username cannot start or end with a dot.")

        # Reject consecutive dots
        if '..' in value:
            raise serializers.ValidationError("Username cannot contain consecutive dots.")

        # Reject more than 2 consecutive identical characters
        if re.search(r'(.)\1{2,}', value, re.IGNORECASE):
            raise serializers.ValidationError(
                "Username cannot have more than 2 consecutive identical characters."
            )

        # Exclude current instance on update
        if self.instance:
            if User.objects.filter(username=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("Username already exists.")
        else:
            if User.objects.filter(username=value).exists():
                raise serializers.ValidationError("Username already exists.")

        return value

    # ------------------------
    # PASSWORD VALIDATION
    # ------------------------

    def validate_password(self, value):
        value = value.strip()
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

    # ------------------------
    # FIRST NAME VALIDATION
    # ------------------------

    def validate_first_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("First name cannot be blank.")

        if len(value) < 3:
            raise serializers.ValidationError(
                "First name must be at least 3 characters."
            )

        if len(value) > 50:
            raise serializers.ValidationError(
                "First name must not exceed 50 characters."
            )

        if not value.isalpha():
            raise serializers.ValidationError(
                "First name must contain letters only."
            )

        if re.search(r'(.)\1{2,}', value, re.IGNORECASE):
            raise serializers.ValidationError(
                "First name cannot have more than 2 consecutive identical characters."
            )

        return value

    # ------------------------
    # LAST NAME VALIDATION
    # ------------------------

    def validate_last_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Last name cannot be blank.")

        if len(value) < 3:
            raise serializers.ValidationError(
                "Last name must be at least 3 characters."
            )

        if len(value) > 50:
            raise serializers.ValidationError(
                "Last name must not exceed 50 characters."
            )

        if not value.isalpha():
            raise serializers.ValidationError(
                "Last name must contain letters only."
            )

        if re.search(r'(.)\1{2,}', value, re.IGNORECASE):
            raise serializers.ValidationError(
                "Last name cannot have more than 2 consecutive identical characters."
            )

        return value

    # ------------------------
    # EMAIL VALIDATION
    # ------------------------

    def validate_email(self, value):
        value = value.strip().lower()

        if not value:
            raise serializers.ValidationError("Email cannot be blank.")

        # RFC-like structure with valid TLD (at least 2 chars after last dot)
        if not re.match(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$', value):
            raise serializers.ValidationError(
                "Enter a valid email address with a proper domain (e.g. user@example.com)."
            )

        # Reject fake/test patterns where local == domain label (e.g. abc@abc.com is fine,
        # but abc@abc with no TLD is already caught above; also reject test@test.test)
        parts = value.split('@')
        local, domain = parts[0], parts[1]
        domain_label = domain.split('.')[0]  # 'abc' from 'abc.com'
        if local == domain_label and len(local) <= 4:
            raise serializers.ValidationError(
                "Email appears to be a test/fake address. Please use a real email."
            )

        # Reject consecutive dots in local part
        if '..' in local:
            raise serializers.ValidationError("Email local part cannot contain consecutive dots.")

        # Exclude current instance on update
        if self.instance:
            if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("Email already exists.")
        else:
            if User.objects.filter(email=value).exists():
                raise serializers.ValidationError("Email already exists.")

        return value
    # ------------------------
    # CREATE USER
    # ------------------------

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        if not password:
            raise serializers.ValidationError(
                {"password": "Password is required."}
            )

        validated_data["email"] = validated_data["email"].lower()

        user = User(**validated_data)
        user.set_password(password)

        try:
            user.save()
        except IntegrityError:
            raise serializers.ValidationError(
                {"email": "Email already exists."}
            )

        return user

    # ------------------------
    # RESTRICT PASSWORD UPDATE
    # ------------------------

    def update(self, instance, validated_data):

        if "password" in validated_data:
            raise serializers.ValidationError(
                {"password": "Password cannot be updated through this endpoint."}
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        try:
            instance.save()
        except IntegrityError:
            raise serializers.ValidationError({"email": "Email already exists."})
        
        return instance


# =========================================================
# SPECIALIZATION SERIALIZER
# =========================================================

class SpecializationSerializer(serializers.ModelSerializer):
    doctor_count = serializers.SerializerMethodField()

    class Meta:
        model = Specialization
        fields = (
            "specialization_id",
            "name",
            "doctor_count",   
            "is_active",      
        )
        read_only_fields = ("specialization_id",)

    def get_doctor_count(self, obj):
        return obj.doctors.filter(is_deleted=False).count()

    def validate_name(self, value):
        import re as _re
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Specialization cannot be blank.")

        if len(value) < 3:
            raise serializers.ValidationError("Specialization must contain at least 3 characters.")

        if len(value) > 100:
            raise serializers.ValidationError("Specialization must not exceed 100 characters.")

        if not _re.match(r'^[A-Za-z\s]+$', value):
            raise serializers.ValidationError("Specialization must contain letters and spaces only.")

        # Reject more than 2 consecutive identical characters (e.g. caaaardiology)
        if _re.search(r'(.)\1{2,}', value, _re.IGNORECASE):
            raise serializers.ValidationError(
                "Specialization cannot have more than 2 consecutive identical characters."
            )

        # Reject repeating 2-4 char patterns (e.g. fdfdfdfdf)
        if _re.search(r'(.{2,4})\1{2,}', value, _re.IGNORECASE):
            raise serializers.ValidationError(
                "Specialization appears to be a meaningless repeated pattern."
            )

        return value


# =========================================================
# STAFF SERIALIZER
# =========================================================

class StaffSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    role = serializers.CharField(write_only=True)
    role_display = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()
    has_doctor_profile = serializers.SerializerMethodField()

    class Meta:
        model = Staff
        fields = (
            "staff_id",
            "staff_code",
            "user",
            "role",
            "role_display",
            "gender",
            "date_of_birth",
            "age",
            "phone",
            "address",
            "qualification",
            "salary",
            "profile_picture",
            "is_active",
            "staff_status",
            "has_doctor_profile", 
        )
        read_only_fields = ("staff_id", "staff_code", "age")

    def get_role_display(self, obj):
        group = obj.user.groups.first()
        return group.name if group else None
    
    def get_has_doctor_profile(self, obj):
        return hasattr(obj, "doctor_profile") and not obj.doctor_profile.is_deleted

    # ------------------------
    # AGE CALCULATION
    # ------------------------

    def get_age(self, obj):
        today = date.today()
        return today.year - obj.date_of_birth.year - (
            (today.month, today.day) <
            (obj.date_of_birth.month, obj.date_of_birth.day)
        )

    # ------------------------
    # PROFILE PICTURE VALIDATION
    # ------------------------

    def validate_profile_picture(self, value):

        if self.instance and value is None and self.instance.profile_picture:
            raise serializers.ValidationError(
                "Profile picture cannot be removed once uploaded."
            )

        if not value and not self.instance:
            raise serializers.ValidationError(
                "Profile picture is mandatory."
            )

        if value:
            if not value.name.lower().endswith((".jpg", ".jpeg", ".png")):
                raise serializers.ValidationError(
                    "Profile picture must be JPG or PNG format."
                )

            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError(
                    "Profile picture size must be less than 2MB."
                )

        return value

    # ------------------------
    # PHONE VALIDATION
    # ------------------------

    def validate_phone(self, value):
        value = value.strip()

        digits = re.sub(r'^\+91', '', value)

        if not re.match(r'^\d{10}$', digits):
            raise serializers.ValidationError(
                "Phone number must be exactly 10 digits (with optional +91 prefix)."
            )

        if not re.match(r'^[6-9]', digits):
            raise serializers.ValidationError(
                "Phone number must start with 6, 7, 8, or 9."
            )

        # All identical digits
        if len(set(digits)) == 1:
            raise serializers.ValidationError(
                "Phone number cannot consist of all identical digits."
            )

        # Sequential ascending pattern (e.g. 1234567890)
        ascending = ''.join(str(i % 10) for i in range(int(digits[0]), int(digits[0]) + 10))
        if digits == ascending:
            raise serializers.ValidationError("Phone number cannot be a sequential pattern.")

        # Entropy check: must have at least 4 unique digits
        if len(set(digits)) < 4:
            raise serializers.ValidationError(
                "Phone number must contain at least 4 different digits."
            )

        return value

    # ------------------------
    # SALARY VALIDATION
    # ------------------------

    def validate_salary(self, value):
        try:
            val = float(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Salary must be a valid number.")

        if val < 1000:
            raise serializers.ValidationError("Salary must be at least ₹1,000.")

        if val > 1_000_000:
            raise serializers.ValidationError("Salary must not exceed ₹10,00,000.")

        return value

    # ------------------------
    # ROLE VALIDATION
    # ------------------------

    def validate_role(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Role cannot be blank.")

        if not Group.objects.filter(name=value).exists():
            raise serializers.ValidationError("Invalid role.")

        return value

    # ------------------------
    # ADDRESS VALIDATION
    # ------------------------

    def validate_address(self, value):
        value = value.strip()
        # Normalize multiple spaces
        value = re.sub(r'  +', ' ', value)

        if not value:
            raise serializers.ValidationError("Address cannot be blank.")

        if len(value) < 5:
            raise serializers.ValidationError("Address must contain at least 5 characters.")

        if len(value) > 100:
            raise serializers.ValidationError("Address must not exceed 100 characters.")

        if not re.match(r"^[A-Za-z0-9\s.,\-()']+$", value):
            raise serializers.ValidationError(
                "Address may only contain letters, numbers, spaces, and . , - ( ) '"
            )

        # Reject more than 3 consecutive identical characters (e.g. waaaaaaashington)
        if re.search(r'(.)\1{3,}', value):
            raise serializers.ValidationError(
                "Address cannot have more than 3 consecutive identical characters."
            )

        # Must contain at least one letter
        if not re.search(r'[A-Za-z]', value):
            raise serializers.ValidationError("Address must contain at least one letter.")

        return value

    # ------------------------
    # QUALIFICATION VALIDATION
    # ------------------------

    def validate_qualification(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Qualification cannot be blank.")

        if len(value) < 3:
            raise serializers.ValidationError("Qualification must contain at least 3 characters.")

        if len(value) > 255:
            raise serializers.ValidationError("Qualification must not exceed 255 characters.")

        if not re.match(r'^[A-Za-z\s.,]+$', value):
            raise serializers.ValidationError(
                "Qualification may only contain letters, spaces, dots and commas."
            )

        # Must contain at least one letter
        if not re.search(r'[A-Za-z]', value):
            raise serializers.ValidationError(
                "Qualification must contain at least one letter."
            )

        # Reject more than 2 consecutive identical characters (e.g. MBBBBSS, MBAAAAA)
        if re.search(r'(.)\1{2,}', value, re.IGNORECASE):
            raise serializers.ValidationError(
                "Qualification cannot have more than 2 consecutive identical characters."
            )

        # Reject symbol/dot only strings
        if re.match(r'^[^A-Za-z]+$', value):
            raise serializers.ValidationError(
                "Qualification cannot be symbols or dots only."
            )

        return value

    # ------------------------
    # CREATE STAFF
    # ------------------------

    def create(self, validated_data):    # ✅ Get raw user data from request

        # ✅ REMOVE user from validated_data
        validated_data.pop("user", None)

        # ✅ Extract user fields from flat form-data
        user_data = {
            "username": self.initial_data.get("user.username"),
            "password": self.initial_data.get("user.password"),
            "first_name": self.initial_data.get("user.first_name"),
            "last_name": self.initial_data.get("user.last_name"),
            "email": self.initial_data.get("user.email"),
        }

        if not user_data.get("username"):
            raise serializers.ValidationError({
                "user": "User data is required."
            })
        # user_data = validated_data.pop("user")
        role_name = validated_data.pop("role")

        with transaction.atomic():
            user_serializer = UserSerializer(data=user_data)
            user_serializer.is_valid(raise_exception=True)
            user = user_serializer.save()

            # 🔥 IMPORTANT FIX → FORCE ACTIVE SYNC
            user.is_active = True
            user.save(update_fields=["is_active"])

            group = Group.objects.get(name=role_name)
            user.groups.add(group)

            try:
                validated_data["is_active"] = True
                staff = Staff.objects.create(user=user, **validated_data)
            except DjangoValidationError as e:
                user.delete()

                if hasattr(e, "message_dict"):
                    raise serializers.ValidationError(e.message_dict)
                else:
                    raise serializers.ValidationError({"non_field_errors": e.messages})

        return staff

    # ------------------------
    # UPDATE STAFF
    # ------------------------

    def update(self, instance, validated_data):

        # ❌ remove nested user handling
        validated_data.pop("user", None)

        # ✅ Extract user fields from FormData
        user_data = {
            "first_name": self.initial_data.get("user.first_name") or instance.user.first_name,
            "last_name": self.initial_data.get("user.last_name") or instance.user.last_name,
            "email": self.initial_data.get("user.email") or instance.user.email,
            "username": instance.user.username,  # NEVER change username
        }

        # ✅ Get role from request directly (important fix)
        role_name = self.initial_data.get("role")

        with transaction.atomic():

            # ✅ UPDATE USER
            user_serializer = UserSerializer(
                instance=instance.user,
                data=user_data,
                partial=True
            )
            user_serializer.is_valid(raise_exception=True)
            user_serializer.save()

            # ✅ HANDLE STATUS (FIXED)
            if "is_active" in self.initial_data:
                new_status = self.initial_data.get("is_active")

                # handle string "true"/"false"
                if isinstance(new_status, str):
                    new_status = new_status.lower() == "true"

                if new_status and not instance.is_active:
                    instance.activate()

                elif not new_status and instance.is_active:
                    instance.deactivate_system()

            # ✅ HANDLE ROLE (FIXED)
            if role_name:
                if not Group.objects.filter(name=role_name).exists():
                    raise serializers.ValidationError({"role": "Invalid role."})

                doctor_profile = getattr(instance, "doctor_profile", None)

                if doctor_profile and not doctor_profile.is_deleted and role_name != "Doctor":
                    raise serializers.ValidationError(
                        {"role": "Cannot change role while DoctorProfile exists."}
                    )

                instance.user.groups.clear()
                group = Group.objects.get(name=role_name)
                instance.user.groups.add(group)

            # UPDATE STAFF FIELDS (CRITICAL FIX)
            instance.gender = self.initial_data.get("gender") or instance.gender
            instance.date_of_birth = self.initial_data.get("date_of_birth") or instance.date_of_birth
            instance.phone = self.initial_data.get("phone") or instance.phone
            instance.address = self.initial_data.get("address") or instance.address
            instance.qualification = self.initial_data.get("qualification") or instance.qualification
            instance.salary = self.initial_data.get("salary") or instance.salary

            # Handle staff_status update
            if "staff_status" in self.initial_data:
                instance.staff_status = self.initial_data.get("staff_status")

            instance.save()

        return instance

# =========================================================
# DOCTOR SCHEDULE SERIALIZER
# =========================================================

class DoctorScheduleSerializer(serializers.ModelSerializer):

    class Meta:
        model = DoctorSchedule
        fields = (
            "schedule_id",
            "doctor",
            "day_of_week",
            "start_time",
            "end_time",
            "is_active",
        )
        read_only_fields = ("schedule_id",)

    def validate_doctor(self, value):

        if value.is_deleted:
            raise serializers.ValidationError(
                "Cannot assign schedule to deleted doctor."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "Cannot assign schedule to inactive doctor."
            )

        if not value.staff.user.is_active:
            raise serializers.ValidationError(
                "Doctor's user account is inactive."
            )

        return value

    def validate(self, attrs):
        from datetime import datetime, timedelta

        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))

        if start_time and end_time:
            if start_time >= end_time:
                raise serializers.ValidationError(
                    {"end_time": "End time must be greater than start time."}
                )

            today = datetime.today().date()
            start_dt = datetime.combine(today, start_time)
            end_dt   = datetime.combine(today, end_time)
            diff     = end_dt - start_dt

            if diff < timedelta(hours=4, minutes=30):
                raise serializers.ValidationError(
                    {"end_time": "Schedule must be at least 4 hours 30 minutes long."}
                )

        return attrs

    def create(self, validated_data):
        try:
            with transaction.atomic():
                schedule = DoctorSchedule.objects.create(**validated_data)
        except DjangoValidationError as e:
            if hasattr(e, "message_dict"):
                raise serializers.ValidationError(e.message_dict)
            else:
                raise serializers.ValidationError({"non_field_errors": e.messages})

        return schedule

    def update(self, instance, validated_data):

        if "doctor" in validated_data and validated_data["doctor"] != instance.doctor:
            raise serializers.ValidationError({"doctor": "Doctor cannot be changed."})

        if "day_of_week" in validated_data and validated_data["day_of_week"] != instance.day_of_week:
            raise serializers.ValidationError({"day_of_week": "Day cannot be changed."})

        try:
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            instance.save()

        except DjangoValidationError as e:
            if hasattr(e, "message_dict"):
                raise serializers.ValidationError(e.message_dict)
            else:
                raise serializers.ValidationError({"non_field_errors": e.messages})

        return instance

# =========================================================
# DOCTOR PROFILE SERIALIZER
# =========================================================

class DoctorProfileSerializer(serializers.ModelSerializer):

    # ✅ READ (for UI display)
    staff = StaffSerializer(read_only=True)

    # ✅ WRITE (for create/update)
    staff_id = serializers.PrimaryKeyRelatedField(
        queryset=Staff.objects.filter(
            is_deleted=False,
            is_active=True,
            user__groups__name="Doctor"
        ),
        source="staff",
        write_only=True
    )

    specialization = SpecializationSerializer(read_only=True)

    specialization_id = serializers.PrimaryKeyRelatedField(
        queryset=Specialization.objects.filter(
            is_deleted=False,
            is_active=True   # ✅ ADD THIS
        ),
        source="specialization",
        write_only=True
    )

    schedules = DoctorScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = DoctorProfile
        fields = (
            "doctor_profile_id",
            "doctor_code",
            "staff",
            "staff_id", 
            "specialization",
            "specialization_id",
            "consultation_fee",
            "max_patient_per_day",
            "is_active",
            "duty_status",
            "schedules",
        )
        read_only_fields = (
            "doctor_profile_id",
            "doctor_code",
        )

    def validate_consultation_fee(self, value):
        try:
            val = float(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Consultation fee must be a valid number.")

        if val < 100:
            raise serializers.ValidationError("Consultation fee must be at least ₹100.")

        if val > 5000:
            raise serializers.ValidationError("Consultation fee must not exceed ₹5,000.")

        return value

    def validate(self, attrs):
        specialization = attrs.get("specialization")

        if specialization and not specialization.is_active:
            raise serializers.ValidationError({
                "specialization": "Cannot assign inactive specialization."
            })

        return attrs

    def validate_staff(self, value):

        if value.is_deleted:
            raise serializers.ValidationError("Cannot assign deleted staff.")

        if not value.is_active:
            raise serializers.ValidationError("Staff must be active.")

        if not getattr(value.user, "groups", None) or not value.user.groups.filter(name="Doctor").exists():
            raise serializers.ValidationError("Staff must have Doctor role.")
        
        return value

    def create(self, validated_data):

        with transaction.atomic():
            try:
                doctor = DoctorProfile.objects.create(**validated_data)
            except IntegrityError:
                raise serializers.ValidationError(
                    {"staff": "Doctor profile already exists for this staff."}
                )

        return doctor

    def update(self, instance, validated_data):

        if "staff" in validated_data and instance.staff != validated_data["staff"]:
            raise serializers.ValidationError(
                {"staff": "Changing assigned staff is not allowed."}
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance
    
    
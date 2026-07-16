from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.views import APIView
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction

from common.permissions import IsAdmin

from administration.models import (
    Staff,
    DoctorProfile,
    Specialization,
    DoctorSchedule
)

from administration.serializers import (
    StaffSerializer,
    DoctorProfileSerializer,
    SpecializationSerializer,
    DoctorScheduleSerializer
)

class AdminDashboardView(APIView):

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):

        total_staff = Staff.objects.filter(is_deleted=False).count()
        active_staff = Staff.objects.filter(is_deleted=False, is_active=True).count()

        total_doctors = DoctorProfile.objects.filter(is_deleted=False).count()
        active_doctors = DoctorProfile.objects.filter(is_deleted=False, is_active=True).count()

        total_specializations = Specialization.objects.filter(is_deleted=False).count()

        recent_staff = (
            Staff.objects.filter(is_deleted=False)
            .select_related("user")
            .order_by("-created_at")[:10]
        )

        data = {
            "total_staff": total_staff,
            "active_staff": active_staff,
            "total_doctors": total_doctors,
            "active_doctors": active_doctors,
            "total_specializations": total_specializations,
            "recent_staff": [
                {
                    "staff_code": s.staff_code,
                    "name": s.user.get_full_name(),
                    "role": s.role,
                    "status": "Active" if s.is_active else "Inactive",
                    "last_login": s.user.last_login
                }
                for s in recent_staff
            ]
        }

        return Response(data)

class RoleListView(APIView):

    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        roles = Group.objects.values_list("name", flat=True)
        return Response(list(roles))

class SpecializationViewSet(viewsets.ModelViewSet):

    serializer_class = SpecializationSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering_fields = ["created_at"]
    ordering = ["name"]

    def get_queryset(self):

        return Specialization.objects.filter(
            is_deleted=False
        )

    # ✅ ACTIVATE
    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):
        specialization = self.get_object()

        specialization.is_active = True
        specialization.version += 1
        specialization.save(update_fields=["is_active", "version", "updated_at"])

        return Response(
            {"detail": "Specialization activated successfully."},
            status=status.HTTP_200_OK
        )


    # ✅ DEACTIVATE
    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):

        specialization = self.get_object()

        # 🔥 ADD THIS CHECK
        if specialization.doctors.filter(is_deleted=False).exists():
            return Response(
                {"detail": "Cannot deactivate specialization in use."},
                status=400
            )

        specialization.is_active = False
        specialization.version += 1
        specialization.save(update_fields=["is_active", "version", "updated_at"])

        return Response(
            {"detail": "Specialization deactivated successfully."},
            status=200
        )
    
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):

        instance = self.get_object()

        if instance.doctors.filter(is_deleted=False).exists():
            return Response(
                {"detail": "Cannot delete specialization assigned to doctors."},
                status=status.HTTP_400_BAD_REQUEST
            )

        instance.is_deleted = True
        instance.is_active = False
        instance.version += 1
        instance.save(update_fields=["is_deleted","is_active","version","updated_at"])

        return Response(
            {"detail": "Specialization deleted successfully."},
            status=status.HTTP_204_NO_CONTENT
        )
        
        
        
class StaffViewSet(viewsets.ModelViewSet):
    # print(request.data)
    http_method_names = ["get", "post", "patch", "delete"]
    serializer_class = StaffSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["is_active"]
    search_fields = ["user__first_name","user__last_name","user__email","staff_code"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):

        return Staff.objects.filter(
            is_deleted=False
        ).select_related("user")

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):

        instance = self.get_object()

        instance.delete()

        return Response(
            {"detail": "Staff deleted successfully."},
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):

        staff = self.get_object()

        staff.activate()

        return Response(
            {"detail": "Staff activated successfully."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):

        staff = self.get_object()

        staff.deactivate_system()

        return Response(
            {"detail": "Staff deactivated successfully."},
            status=status.HTTP_200_OK
        )
        
        
        
class DoctorProfileViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch"]
    serializer_class = DoctorProfileSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["specialization", "is_active"]
    search_fields = [
    "doctor_code",
    "staff__user__first_name",
    "staff__user__last_name"
    ]

    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):

        return DoctorProfile.objects.filter(
            is_deleted=False
        ).select_related(
            "staff",
            "staff__user",
            "specialization"
        )


    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "Doctor deletion is not allowed. Delete staff instead."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )

    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):

        doctor = self.get_object()
        staff = doctor.staff

        if staff.is_deleted:
            return Response(
                {"detail": "Cannot activate doctor because staff is deleted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():

            # 🔥 ensure staff active first
            if not staff.is_active:
                staff.activate()

            doctor.is_active = True
            doctor.version += 1
            doctor.save(update_fields=["is_active", "version", "updated_at"])

        return Response(
            {"detail": "Doctor activated successfully."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):

        doctor = self.get_object()

        with transaction.atomic():
            doctor.is_active = False
            doctor.duty_status = "OFF_DUTY"
            doctor.version += 1
            doctor.save(update_fields=["is_active", "duty_status", "version", "updated_at"])

            # Cascade: deactivate linked staff, user, and schedules
            staff = doctor.staff
            if staff.is_active:
                staff.deactivate_system()

        return Response(
            {"detail": "Doctor deactivated successfully."},
            status=status.HTTP_200_OK
        )
        
        
        
class DoctorScheduleViewSet(viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch"]
    serializer_class = DoctorScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    filterset_fields = ["doctor", "day_of_week", "is_active"]
    search_fields = [
    "doctor__staff__user__first_name",
    "doctor__staff__user__last_name",
    "doctor__specialization__name",
    "doctor__doctor_code"
    ]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):

        return DoctorSchedule.objects.filter(
            is_deleted=False
        ).select_related(
            "doctor",
            "doctor__staff",
            "doctor__staff__user"
        )

    # @transaction.atomic
    # def destroy(self, request, *args, **kwargs):

    #     schedule = self.get_object()

    #     schedule.is_deleted = True
    #     schedule.is_active = False
    #     schedule.version += 1
    #     schedule.save(update_fields=["is_deleted","is_active","version","updated_at"])

    #     return Response(
    #         {"detail": "Doctor schedule deleted successfully."},
    #         status=status.HTTP_204_NO_CONTENT
    #     )

    @action(detail=True, methods=["patch"])
    def activate(self, request, pk=None):

        schedule = self.get_object()
        doctor = schedule.doctor

        if doctor.is_deleted or not doctor.is_active:
            return Response(
                {"detail": "Cannot activate schedule for inactive doctor."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            schedule.is_active = True

            # Model validation (business rules)
            try:
                schedule.full_clean()
            except ValidationError as e:
                return Response({"detail": getattr(e, "message_dict", e.messages)}, status=400)

            # DB-level locking (concurrency safety)
            overlapping = DoctorSchedule.objects.select_for_update().filter(
                doctor=schedule.doctor,
                day_of_week=schedule.day_of_week,
                is_deleted=False,
                is_active=True
            ).exclude(pk=schedule.pk)

            for s in overlapping:
                if (
                    schedule.start_time < s.end_time and
                    schedule.end_time > s.start_time
                ):
                    return Response(
                        {"detail": "Schedule overlaps with existing active schedule."},
                        status=400
                    )

            schedule.version += 1
            schedule.save(update_fields=["is_active", "version", "updated_at"])

        return Response(
            {"detail": "Schedule activated successfully."},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=["patch"])
    def deactivate(self, request, pk=None):

        schedule = self.get_object()

        schedule.is_active = False
        schedule.version += 1
        schedule.save(update_fields=["is_active", "version", "updated_at"])

        return Response(
            {"detail": "Schedule deactivated successfully."},
            status=status.HTTP_200_OK
        )
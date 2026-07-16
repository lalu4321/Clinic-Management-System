from rest_framework.permissions import BasePermission
from common.permissions import IsLabTechnician
class IsDoctor(BasePermission):
    """
    Allows access only to users in the 'Doctor' group.
    """
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.groups.filter(name="Doctor").exists()
        )
        
class IsDoctorOrLabTechnician(BasePermission):
    def has_permission(self, request, view):
        return (
            IsDoctor().has_permission(request, view) or
            IsLabTechnician().has_permission(request, view)
        )
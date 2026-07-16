from django.contrib import admin
from .models import DoctorProfile
from .models import Staff
from .models import Specialization,DoctorSchedule
admin.site.register(DoctorProfile)
admin.site.register(Staff)
admin.site.register(Specialization)
admin.site.register(DoctorSchedule)
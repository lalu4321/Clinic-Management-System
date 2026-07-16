from django.contrib import admin

# Register your models here.

from .models import  Prescription, PrescriptionItem,LabTestRequest

admin.site.register(Prescription)
admin.site.register(PrescriptionItem)

admin.site.register(LabTestRequest)
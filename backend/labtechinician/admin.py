# from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    LabTestCatalog, 
    LabTestResult, 
    LabReport, 
    LabBill, 
    LabBillItem
)

# Registering the Lab models to appear in the Django Admin Panel
admin.site.register(LabTestCatalog)
admin.site.register(LabTestResult)
admin.site.register(LabReport)
admin.site.register(LabBill)
admin.site.register(LabBillItem)

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [

    path("admin/", admin.site.urls),
    
    path(
        "api/administration/",
        include("administration.urls")
    ),

    path("api/auth/", include("authentication.urls")),

    path("api/admin/", include("administration.urls")),

    path("api/reception/", include("reception.urls")),

    path("api/doctor/", include("doctor.urls")),

    path("api/pharmacy/", include("pharmacist.urls")),

    path("api/lab/", include("labtechinician.urls")),


    path("api/appointments/", include("common.urls")),

]

# Serve media files in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
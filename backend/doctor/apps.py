from django.apps import AppConfig


class DoctorConfig(AppConfig):
    name = 'doctor'
    default_auto_field = 'django.db.models.BigAutoField'
    
    def ready(self):
        import doctor.signals
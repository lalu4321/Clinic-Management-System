from django.apps import AppConfig


class LabtechinicianConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'    
    name = 'labtechinician'
    
    def ready(self):
        import labtechinician.signals
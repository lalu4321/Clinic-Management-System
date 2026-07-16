from django.apps import AppConfig



class PharmacistConfig(AppConfig):
    name = "pharmacist"

    def ready(self):
        import pharmacist.signals

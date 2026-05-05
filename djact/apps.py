from django.apps import AppConfig


class DjactConfig(AppConfig):
    name = "djact"
    verbose_name = "Djact"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        pass

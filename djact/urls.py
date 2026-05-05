from django.urls import path

from djact.views import djact_endpoint

urlpatterns = [
    path("djact", djact_endpoint, name="djact-endpoint"),
]

from django.urls import path

from djact.views import djact_endpoint

app_name = "djact"

urlpatterns = [
    path("djact/", djact_endpoint, name="djact-endpoint"),
]

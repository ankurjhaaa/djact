"""
djact.views — Single POST endpoint for all component method calls.

Expects JSON body:
{
    "component": "home",
    "method": "save",
    "data": { ... current state ... }
}

Dynamically loads the component via importlib, calls the method,
and returns JSON.

ValidationError from validate() is auto-caught and returned as
{"errors": {...}} — the developer never needs to check manually.
"""
import json
import inspect

from django.conf import settings
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_protect

from djact.loader import load_component, ComponentNotFoundError
from djact.validation import ValidationError


@csrf_protect
def djact_endpoint(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    # --- parse body -------------------------------------------------------
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    component_name = payload.get("component", "")
    method_name = payload.get("method", "")
    data = payload.get("data", {})

    if not component_name or not isinstance(component_name, str):
        return JsonResponse({"error": "Missing component name"}, status=400)

    if not method_name or not isinstance(method_name, str):
        return JsonResponse({"error": "Missing method name"}, status=400)

    # --- load component ---------------------------------------------------
    try:
        component = load_component(component_name)
    except ComponentNotFoundError as exc:
        return JsonResponse({"error": str(exc)}, status=404)

    # --- resolve method ---------------------------------------------------
    handler = getattr(component, method_name, None)
    if handler is None or not callable(handler):
        return JsonResponse(
            {"error": f"Method '{method_name}' not found on component '{component_name}'."},
            status=404,
        )

    # Prevent calling private/dunder methods
    if method_name.startswith("_"):
        return JsonResponse(
            {"error": f"Cannot call private method '{method_name}'."},
            status=403,
        )

    # --- execute ----------------------------------------------------------
    try:
        passed_args = data.pop("__args", []) if isinstance(data, dict) else []
        params = list(inspect.signature(handler).parameters.values())

        if method_name == "mount":
            if len(params) >= 2 and params[1].name == "data":
                result = handler(request, data)
            else:
                result = handler(request)
        elif len(params) >= 2 and params[1].name == "data":
            # method(self, request, data, *args)
            result = handler(request, data, *passed_args)
        elif len(params) >= 2:
            # method(self, request, *args)
            result = handler(request, *passed_args)
        else:
            # method(self, request)
            result = handler(request)

    except ValidationError as exc:
        # Auto-return validation errors — developer doesn't check manually
        return JsonResponse({"errors": exc.errors}, status=200)

    except Exception as exc:
        debug = getattr(settings, "DEBUG", False)
        detail = str(exc) if debug else "Internal server error"
        return JsonResponse({"error": detail}, status=500)

    if result is None:
        result = {}

    return JsonResponse(result, status=200)

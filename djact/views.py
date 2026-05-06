"""
djact.views — Single POST endpoint for all component method calls.

Expects JSON body:
{
    "component": "todo",
    "method": "add_task",
    "data": { ... current state + form data ... }
}
"""
import json
import inspect
from typing import Callable

from django.conf import settings
from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_protect

from djact.registry import get_registry


@csrf_protect
def djact_endpoint(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    # --- parse body -------------------------------------------------------
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    component = payload.get("component", "")
    method = payload.get("method", "")
    data = payload.get("data", {})

    if not component or not isinstance(component, str):
        return JsonResponse({"error": "Missing component name"}, status=400)

    if not method or not isinstance(method, str):
        return JsonResponse({"error": "Missing method name"}, status=400)

    # --- resolve handler --------------------------------------------------
    registry = get_registry()
    handler: Callable | None = registry.get_handler(component, method)

    if handler is None:
        return JsonResponse(
            {"error": f"Unknown method '{method}' on component '{component}'"},
            status=404,
        )

    # --- execute ----------------------------------------------------------
    try:
        passed_args = data.get("__args", [])
        params = list(inspect.signature(handler).parameters.values())
        
        if len(params) > 1 and params[1].name == "data":
            result = handler(request, data, *passed_args)
        elif len(params) > 1:
            result = handler(request, *passed_args)
        else:
            result = handler(request)
    except Exception as exc:
        debug = getattr(settings, "DEBUG", False)
        detail = str(exc) if debug else "Internal server error"
        return JsonResponse({"error": detail}, status=500)

    if result is None:
        result = {}

    return JsonResponse(result, status=200)

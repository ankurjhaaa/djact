import json
import inspect
from typing import Callable

from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_protect

from djact.registry import get_registry


@csrf_protect
def djact_endpoint(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    method = payload.get("method")
    data = payload.get("data", {})
    if not method or not isinstance(method, str):
        return JsonResponse({"error": "Invalid method"}, status=400)

    registry = get_registry(request)
    handler: Callable | None = registry.get(method)
    if handler is None:
        return JsonResponse({"error": "Unknown method"}, status=404)

    try:
        params = list(inspect.signature(handler).parameters.values())
        if len(params) == 1:
            result = handler(request)
        else:
            result = handler(request, data)
    except Exception as exc:
        return JsonResponse({"error": "Server error", "details": str(exc)}, status=500)

    if result is None:
        result = {}

    return JsonResponse(result, status=200)

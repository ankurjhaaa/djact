"""
djact.render
~~~~~~~~~~~~
Core rendering helper — the primary public API of djact.
"""

import json

from django.http import JsonResponse
from django.shortcuts import render as django_render

from djact.utils import is_djact_request

DJACT_HEADER = "X-Djact"

# Characters that must be escaped when embedding JSON in an HTML attribute.
# json.dumps handles < > & by default; we also ensure ' is escaped so the
# value is safe inside single-quoted attributes.
_JSON_ESCAPE_TABLE = str.maketrans(
    {
        "<": r"\u003c",
        ">": r"\u003e",
        "&": r"\u0026",
        "'": r"\u0027",
    }
)


def _safe_json(data: dict) -> str:
    """Serialise *data* to a JSON string that is safe to embed in HTML attributes.

    Uses ``json.dumps`` with ``ensure_ascii=False`` (so unicode characters are
    kept readable) and then escapes the five characters that are dangerous
    inside HTML attribute values: ``< > & ' "``.  The result can be placed
    directly in a ``data-page="..."`` or ``data-page='...'`` attribute using
    Django's ``|safe`` template filter without risk of XSS.
    """
    raw = json.dumps(data, ensure_ascii=False)
    return raw.translate(_JSON_ESCAPE_TABLE)


def djact_render(
    request,
    component: str,
    props: dict | None = None,
    *,
    status: int = 200,
    extra_context: dict | None = None,
):
    """Render a React component via the Djact bridge.

    On a full (first-visit) request returns a complete HTML page.
    On a Djact XHR navigation request (``X-Djact`` header) returns a
    lightweight JSON payload so the client router can swap components
    without a full reload.

    Args:
        request:        The current Django ``HttpRequest``.
        component:      React component name, e.g. ``"library/Dashboard"``.
                        Supports multi-app names with slash separators.
        props:          JSON-serialisable dict of props.  Defaults to ``{}``.
        status:         HTTP status code.  Defaults to ``200``.
        extra_context:  Additional context variables merged into the template
                        context (full-page renders only).  Use to pass a custom
                        ``title`` or any other template variable.

    Returns:
        ``JsonResponse``      — XHR navigation (``X-Djact`` header present).
        ``TemplateResponse``  — Full-page first load.
    """
    if props is None:
        props = {}

    # Merge shared data from middleware if available
    final_props = {}
    if hasattr(request, "djact"):
        final_props.update(request.djact.get_shared())
    final_props.update(props)

    page_payload: dict = {
        "component": component,
        "props": final_props,
        "url": request.get_full_path(),
    }

    if is_djact_request(request):
        return JsonResponse(page_payload, status=status)

    context = {"page": _safe_json(page_payload)}
    if extra_context:
        context.update(extra_context)

    return django_render(
        request,
        "djact/djact.html",
        context,
        status=status,
    )

"""
djact.pagination — Server-side pagination helper.

Usage in component:

    from djact.pagination import paginate

    class Component:
        def mount(self, request):
            users = paginate(User.objects.all(), request, 10)
            return {"users": users}

        def change_page(self, request, data):
            users = paginate(User.objects.all(), request, 10)
            return {"users": users}

Template:
    <div dj:for="user in users">[[ user.name ]]</div>
    <div dj:paginate="users"></div>

The function auto-detects the page number from the request body (__page).
"""
from __future__ import annotations

import json
import math
from typing import Any


def paginate(queryset, page=1, per_page: int = 10) -> dict[str, Any]:
    """Paginate a Django QuerySet and return a pagination-ready dict.

    Args:
        queryset: Django QuerySet or list to paginate.
        page: Page number (int) OR a Django HttpRequest object.
              If a request object, __page is auto-extracted from POST body.
        per_page: Number of items per page.

    Returns:
        Dict with { data, current_page, last_page, per_page, total }
        ready to be used as a state value with dj:for and dj:paginate.
    """
    # If page is a request object, extract __page from JSON body
    if hasattr(page, "body"):
        page = _extract_page(page)

    page = max(1, int(page))
    per_page = max(1, int(per_page))

    # Support both QuerySet and plain list
    if hasattr(queryset, "count"):
        total = queryset.count()
    else:
        total = len(queryset)

    total_pages = max(1, math.ceil(total / per_page))

    # Clamp page
    if page > total_pages:
        page = total_pages

    offset = (page - 1) * per_page

    # Slice data — auto-serialize QuerySet to list of dicts
    if hasattr(queryset, "values"):
        items = list(queryset[offset:offset + per_page].values())
    elif hasattr(queryset, "__getitem__"):
        items = list(queryset[offset:offset + per_page])
    else:
        items = list(queryset)

    return {
        "data": items,
        "current_page": page,
        "last_page": total_pages,
        "per_page": per_page,
        "total": total,
    }


def _extract_page(request) -> int:
    """Extract page number from Django request's JSON body."""
    try:
        body = json.loads(request.body.decode("utf-8"))
        data = body.get("data", {})
        if isinstance(data, dict):
            return int(data.get("__page", 1))
    except Exception:
        pass

    # Fallback: try GET parameter
    try:
        return int(request.GET.get("page", 1))
    except (ValueError, AttributeError):
        pass

    return 1

"""
djact.pagination — Server-side pagination helper.

Usage:
    from djact.pagination import paginate

    class Component:
        def mount(self, request):
            users = paginate(User.objects.all(), request, 10)
            return {"users": users}

        def delete_user(self, request, data, user_id):
            User.objects.filter(id=user_id).delete()
            users = paginate(User.objects.all(), request, 10)
            return {"users": users}

No need for change_page method — pagination is handled automatically.

Template:
    <div dj:for="user in users">[[ user.name ]]</div>
    <div dj:paginate="users"></div>
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
              If request object, page is auto-extracted from POST body.
              Preserves current page from state when no explicit __page.
        per_page: Number of items per page.

    Returns:
        Dict with { data, current_page, last_page, per_page, total }
    """
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
    """Extract page number from Django request.

    Priority:
    1. __page in POST body data (explicit page change click)
    2. current_page from any paginated state value (preserves page on actions)
    3. GET ?page= parameter
    4. Default to 1
    """
    try:
        body = json.loads(request.body.decode("utf-8"))
        data = body.get("data", {})

        if isinstance(data, dict):
            # 1. Explicit page change (from pagination click)
            if "__page" in data:
                return int(data["__page"])

            # 2. Preserve current page from state
            # When delete/save is called, state contains the paginated
            # value like {data: [...], current_page: 5, ...}
            for value in data.values():
                if isinstance(value, dict) and "current_page" in value:
                    return int(value["current_page"])

    except Exception:
        pass

    # 3. GET parameter fallback
    try:
        return int(request.GET.get("page", 1))
    except (ValueError, AttributeError):
        pass

    return 1

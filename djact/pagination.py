"""
djact.pagination — Server-side pagination helper.

Usage in component:

    from djact.pagination import paginate

    class Component:
        def mount(self, request):
            return paginate(User.objects.all(), page=1, per_page=10, key="users")

        def change_page(self, request, data):
            return paginate(User.objects.all(), page=data.get("__page", 1), per_page=10, key="users")

Template:
    <div dj:for="user in users">[[ user.name ]]</div>
    <div dj:paginate="users"></div>
"""
from __future__ import annotations

import math
from typing import Any


def paginate(queryset, page: int = 1, per_page: int = 10, key: str = "items") -> dict[str, Any]:
    """Paginate a Django QuerySet and return state-ready dict.

    Args:
        queryset: Django QuerySet or list to paginate.
        page: Current page number (1-indexed).
        per_page: Number of items per page.
        key: State key name for the data list.

    Returns:
        Dict with paginated data and pagination metadata, ready to
        return from a Component method.
    """
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

    # Slice data
    if hasattr(queryset, "values"):
        # Django QuerySet — auto-serialize to list of dicts
        items = list(queryset[offset:offset + per_page].values())
    elif hasattr(queryset, "__getitem__"):
        items = list(queryset[offset:offset + per_page])
    else:
        items = list(queryset)

    return {
        key: items,
        "pagination": {
            "current_page": page,
            "total_pages": total_pages,
            "per_page": per_page,
            "total": total,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }

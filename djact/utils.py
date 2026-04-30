"""
djact.utils
~~~~~~~~~~~
Internal utility helpers shared across the package.
"""

# Django normalises HTTP headers: uppercase, hyphens → underscores, HTTP_ prefix.
_DJACT_META_KEY = "HTTP_X_DJACT"


def is_djact_request(request) -> bool:
    """Return True when the request carries the X-Djact header."""
    return _DJACT_META_KEY in request.META


def get_csrf_token(request) -> str | None:
    """Return the CSRF token for the current request, or None on failure."""
    try:
        from django.middleware.csrf import get_token

        return get_token(request)
    except Exception:
        return None

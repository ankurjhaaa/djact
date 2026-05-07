"""
djact.middleware — Auto-inject Djact assets into HTML responses.

Injects (only when dj:component is detected in the HTML):
1. CSRF <meta> tag (for secure AJAX)
2. Djact endpoint URL <meta> tag (so JS doesn't hardcode the URL)
3. auto.js <script> tag (client runtime)
"""
from __future__ import annotations

from django.conf import settings
from django.middleware.csrf import get_token


class DjactAutoLoadMiddleware:
    """Auto-inject Djact assets when dj:component is present in the response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not _is_html_response(response):
            return response

        charset = getattr(response, "charset", "utf-8")
        content = response.content.decode(charset)

        # Only inject assets if this page uses djact components
        if "dj:component" not in content:
            return response

        content = _ensure_csrf_meta(content, request)
        content = _ensure_endpoint_meta(content)
        content = _inject_auto_script(content)

        response.content = content.encode(charset)
        response["Content-Length"] = str(len(response.content))
        return response


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------

def _is_html_response(response) -> bool:
    content_type = response.get("Content-Type", "")
    return "text/html" in content_type


# ---------------------------------------------------------------------------
# Injectors
# ---------------------------------------------------------------------------

def _ensure_csrf_meta(content: str, request) -> str:
    if 'name="csrf-token"' in content or "name='csrf-token'" in content:
        return content

    token = get_token(request)
    meta = f'<meta name="csrf-token" content="{token}">'

    if "<head>" in content:
        return content.replace("<head>", "<head>\n    " + meta, 1)
    if "<head " in content:
        idx = content.index("<head ")
        close = content.index(">", idx)
        return content[:close + 1] + "\n    " + meta + content[close + 1:]

    return meta + content


def _ensure_endpoint_meta(content: str) -> str:
    if 'name="djact-url"' in content:
        return content

    endpoint_url = _resolve_endpoint_url()
    meta = f'<meta name="djact-url" content="{endpoint_url}">'

    if "<head>" in content:
        return content.replace("<head>", "<head>\n    " + meta, 1)
    if "<head " in content:
        idx = content.index("<head ")
        close = content.index(">", idx)
        return content[:close + 1] + "\n    " + meta + content[close + 1:]

    return meta + content


def _resolve_endpoint_url() -> str:
    """Resolve djact endpoint URL. Falls back to /djact/ if reverse fails."""
    custom_url = getattr(settings, "DJACT_ENDPOINT_URL", None)
    if custom_url:
        return custom_url

    try:
        from django.urls import reverse
        return reverse("djact:djact-endpoint")
    except Exception:
        try:
            from django.urls import reverse
            return reverse("djact-endpoint")
        except Exception:
            return "/djact/"


def _inject_auto_script(content: str) -> str:
    static_url = settings.STATIC_URL or "/static/"
    if not static_url.endswith("/"):
        static_url += "/"

    script = f'<script type="module" src="{static_url}djact/auto.js"></script>'

    if script in content:
        return content

    if "</body>" in content:
        return content.replace("</body>", f"\n    {script}\n</body>", 1)

    return content + script

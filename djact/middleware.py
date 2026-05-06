"""
djact.middleware — Auto-inject Djact assets into .dj.html responses.

Injects:
1. CSRF <meta> tag (for secure AJAX)
2. Djact endpoint URL <meta> tag (so JS doesn't hardcode the URL)
3. auto.js <script> tag (client runtime)
"""
from __future__ import annotations

from django.conf import settings
from django.middleware.csrf import get_token


class DjactAutoLoadMiddleware:
    """Auto-inject Djact assets for templates ending with .dj.html."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not _is_html_response(response):
            return response

        charset = getattr(response, "charset", "utf-8")
        content = response.content.decode(charset)

        if not _is_djact_template(response, content):
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


def _is_djact_template(response, content: str) -> bool:
    template_name = getattr(response, "template_name", None)
    if template_name is None:
        # Fallback: check if content has djact directives
        return "dj:component" in content or "dj:state" in content

    if isinstance(template_name, (list, tuple)):
        return any(str(name).endswith(".dj.html") for name in template_name)

    return str(template_name).endswith(".dj.html")


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

    # Try to resolve the endpoint URL from Django's URL conf
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
    # Check for user override in settings
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

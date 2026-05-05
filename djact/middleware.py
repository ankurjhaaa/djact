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

        if not _is_djact_template(response):
            return response

        charset = getattr(response, "charset", "utf-8")
        content = response.content.decode(charset)

        content = _ensure_csrf_meta(content, request)
        content = _inject_auto_script(content)

        response.content = content.encode(charset)
        response["Content-Length"] = str(len(response.content))
        return response


def _is_html_response(response) -> bool:
    content_type = response.get("Content-Type", "")
    return "text/html" in content_type


def _is_djact_template(response) -> bool:
    template_name = getattr(response, "template_name", None)
    if template_name is None:
        return False

    if isinstance(template_name, (list, tuple)):
        return any(str(name).endswith(".dj.html") for name in template_name)

    return str(template_name).endswith(".dj.html")


def _ensure_csrf_meta(content: str, request) -> str:
    if "meta name=\"csrf-token\"" in content or "meta name='csrf-token'" in content:
        return content

    token = get_token(request)
    meta = f"<meta name=\"csrf-token\" content=\"{token}\">"

    if "<head>" in content:
        return content.replace("<head>", "<head>\n    " + meta, 1)

    return meta + content


def _inject_auto_script(content: str) -> str:
    static_url = settings.STATIC_URL or "/static/"
    if not static_url.endswith("/"):
        static_url += "/"

    script = (
        f"<script type=\"module\" src=\"{static_url}djact/auto.js\"></script>"
    )

    if script in content:
        return content

    if "</body>" in content:
        return content.replace("</body>", f"\n    {script}\n</body>", 1)

    return content + script

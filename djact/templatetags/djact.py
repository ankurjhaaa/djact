from __future__ import annotations

from django import template

from djact.parser import extract_functions, DjactParseError
from djact.registry import get_registry

register = template.Library()


@register.tag("djact")
def djact_tag(parser, token):
    nodelist = parser.parse(("enddjact",))
    parser.delete_first_token()
    block = nodelist.render(template.Context())

    try:
        funcs = extract_functions(block)
    except DjactParseError as exc:
        raise template.TemplateSyntaxError(str(exc))

    registry = get_registry()
    for name, func in funcs.items():
        registry.register(name, func)

    return DjactNode()


class DjactNode(template.Node):
    def render(self, context):
        return ""  # Nothing is rendered into the template output

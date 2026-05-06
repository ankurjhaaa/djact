"""
djact template tags — {% djact "component_name" %} ... {% enddjact %}

The block content (Python code) is validated at template parse time
but only compiled/executed lazily on the first request.
"""
from __future__ import annotations

from django import template

from djact.parser import validate_and_store, DjactParseError
from djact.registry import get_registry

register = template.Library()


@register.tag("djact")
def djact_tag(parser, token):
    bits = token.split_contents()

    if len(bits) < 2:
        raise template.TemplateSyntaxError(
            "{% djact %} requires a component name, "
            'e.g. {% djact "counter" %}'
        )

    # Strip quotes from component name
    component_name = bits[1].strip("'\"")

    # Parse until {% enddjact %}
    nodelist = parser.parse(("enddjact",))
    parser.delete_first_token()

    # Render the block with an empty context to get raw Python source
    raw_block = nodelist.render(template.Context())

    # Validate AST (no exec yet) and store source in registry
    try:
        source = validate_and_store(raw_block, component_name)
    except DjactParseError as exc:
        raise template.TemplateSyntaxError(str(exc))

    registry = get_registry()
    registry.register_source(component_name, source)

    return DjactNode()


class DjactNode(template.Node):
    """Renders nothing — the Python block is server-only logic."""

    def render(self, context):
        return ""

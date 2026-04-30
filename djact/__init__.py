"""
djact — Inertia.js-like bridge between Django and React.
"""

default_app_config = "djact.apps.DjactConfig"

from djact.render import djact_render  # noqa: E402, F401

__all__ = ["djact_render"]
__version__ = "1.0.0"

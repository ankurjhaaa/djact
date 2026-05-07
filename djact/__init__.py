"""
djact — File-based reactive components for Django.

Write Component classes in Python files, use dj: directives in HTML.
Server returns JSON, client updates DOM reactively.
"""

__version__ = "4.1.0"
__all__ = ["djact_endpoint"]

from djact.views import djact_endpoint  # noqa: E402, F401
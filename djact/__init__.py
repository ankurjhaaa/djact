"""
djact — File-based reactive components for Django.

Write Component classes in Python files, use dj: directives in HTML.
Server returns JSON, client updates DOM reactively.
"""

__version__ = "4.1.2"
__all__ = ["djact_endpoint", "paginate"]

from djact.views import djact_endpoint  # noqa: E402, F401
from djact.pagination import paginate  # noqa: E402, F401
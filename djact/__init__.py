"""
djact — Livewire-style single-file components for Django.

Write Python logic and HTML in the same template.
Server returns JSON, client updates DOM reactively.
"""

__version__ = "3.0.1"
__all__ = ["djact_endpoint"]

from djact.views import djact_endpoint  # noqa: E402, F401
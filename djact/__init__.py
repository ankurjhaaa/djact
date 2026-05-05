"""
djact — lightweight HTML-first interaction for Django.
"""

default_app_config = "djact.apps.DjactConfig"

from djact.views import djact_endpoint  # noqa: E402, F401

__all__ = ["djact_endpoint"]
__version__ = "2.0.4"
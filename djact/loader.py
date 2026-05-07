"""
djact.loader — Dynamic component loader.

Resolves component names to Python classes using importlib.

    dj:component="home"             → {app}/components/home.py → Component
    dj:component="public/dashboard" → {app}/components/public/dashboard.py → Component

Components are discovered from all installed Django apps that contain
a ``components/`` sub-package, similar to how Django discovers
``templatetags/`` or ``management/commands/``.
"""
from __future__ import annotations

import importlib
import threading
from typing import Any

from django.apps import apps as django_apps
from django.conf import settings


class _ComponentCache:
    """Thread-safe cache for loaded Component instances."""

    def __init__(self) -> None:
        self._cache: dict[str, Any] = {}
        self._lock = threading.Lock()

    def get_or_load(self, component_name: str) -> Any:
        if component_name in self._cache:
            return self._cache[component_name]

        with self._lock:
            # Double-check after lock
            if component_name in self._cache:
                return self._cache[component_name]

            instance = _import_component(component_name)
            self._cache[component_name] = instance
            return instance

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


_cache = _ComponentCache()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_component(name: str) -> Any:
    """Load and return a Component instance for the given name.

    Raises ``ComponentNotFoundError`` if no matching component exists.
    """
    return _cache.get_or_load(name)


def clear_cache() -> None:
    """Clear the component cache (useful for development/testing)."""
    _cache.clear()


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ComponentNotFoundError(Exception):
    pass


class ComponentMethodError(Exception):
    pass


# ---------------------------------------------------------------------------
# Internal import logic
# ---------------------------------------------------------------------------

def _import_component(name: str) -> Any:
    """Try to import ``Component`` from each installed app's components package.

    For name="public/dashboard", tries:
        {app_label}.components.public.dashboard

    The first app that has the matching module wins.
    """
    # Convert slash path to dotted module path
    module_suffix = name.replace("/", ".")

    # 1. Check for explicit components directory setting
    explicit_dir = getattr(settings, "DJACT_COMPONENTS_MODULE", None)
    if explicit_dir:
        module_path = f"{explicit_dir}.{module_suffix}"
        return _try_import(module_path, name)

    # 2. Auto-discover from installed apps
    for app_config in django_apps.get_app_configs():
        module_path = f"{app_config.name}.components.{module_suffix}"
        try:
            return _try_import(module_path, name)
        except ComponentNotFoundError:
            continue

    raise ComponentNotFoundError(
        f"Component '{name}' not found. "
        f"Searched in all installed apps for 'components/{name.replace('.', '/')}.py'. "
        f"Make sure the file exists and contains a 'Component' class."
    )


def _try_import(module_path: str, component_name: str) -> Any:
    """Import a module and return an instance of its Component class."""
    try:
        module = importlib.import_module(module_path)
    except ModuleNotFoundError:
        raise ComponentNotFoundError(
            f"Module '{module_path}' not found for component '{component_name}'."
        )

    cls = getattr(module, "Component", None)
    if cls is None:
        raise ComponentNotFoundError(
            f"Module '{module_path}' exists but has no 'Component' class."
        )

    if not callable(cls):
        raise ComponentNotFoundError(
            f"'Component' in '{module_path}' is not a class."
        )

    instance = cls()

    # Validate mount() exists
    if not hasattr(instance, "mount") or not callable(getattr(instance, "mount")):
        raise ComponentNotFoundError(
            f"Component '{component_name}' must have a mount(self, request) method."
        )

    return instance

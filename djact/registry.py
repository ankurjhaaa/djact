"""
djact.registry — Per-component handler registry.

Each {% djact "name" %} block registers its source code under that name.
On the first request the source is compiled into callable functions.
"""
from __future__ import annotations

import threading
from typing import Callable

from djact.parser import compile_component


class DjactRegistry:
    """Thread-safe registry keyed by component name."""

    def __init__(self) -> None:
        self._sources: dict[str, str] = {}
        self._compiled: dict[str, dict[str, Callable]] = {}
        self._lock = threading.Lock()

    # -- registration (called at template parse time) --------------------

    def register_source(self, component_name: str, source: str) -> None:
        """Store validated source code for a component."""
        with self._lock:
            self._sources[component_name] = source
            # Invalidate any previously compiled version
            self._compiled.pop(component_name, None)

    # -- lookup (called at request time) ---------------------------------

    def get_handler(
        self, component_name: str, method_name: str
    ) -> Callable | None:
        """Return the callable for *component_name.method_name*.

        Lazy-compiles the component source on first access.
        """
        funcs = self._ensure_compiled(component_name)
        if funcs is None:
            return None
        return funcs.get(method_name)

    def get_all_handlers(
        self, component_name: str
    ) -> dict[str, Callable] | None:
        """Return all handlers for a component (used by mount)."""
        return self._ensure_compiled(component_name)

    # -- internals -------------------------------------------------------

    def _ensure_compiled(
        self, component_name: str
    ) -> dict[str, Callable] | None:
        if component_name in self._compiled:
            return self._compiled[component_name]

        source = self._sources.get(component_name)
        if source is None:
            return None

        with self._lock:
            # Double-check after acquiring lock
            if component_name in self._compiled:
                return self._compiled[component_name]

            funcs = compile_component(source, component_name)
            self._compiled[component_name] = funcs
            return funcs


# Module-level singleton — shared across the Django process.
_registry = DjactRegistry()


def get_registry() -> DjactRegistry:
    return _registry

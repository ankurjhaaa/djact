from __future__ import annotations

from typing import Callable


class DjactRegistry:
    def __init__(self):
        self._handlers: dict[str, Callable] = {}

    def register(self, name: str, func: Callable) -> None:
        self._handlers[name] = func

    def get(self, name: str) -> Callable | None:
        return self._handlers.get(name)


def get_registry(request=None) -> DjactRegistry:
    # Global singleton registry. It is populated by the template tag parser.
    global _REGISTRY
    try:
        return _REGISTRY
    except NameError:
        _REGISTRY = DjactRegistry()
        return _REGISTRY

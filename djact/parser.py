"""
djact.parser — Parse Python code from {% djact %} template blocks.

Supports import statements and function definitions.
Functions are compiled but NOT executed at parse time — they are
stored as source and lazily compiled/executed at request time.
"""
from __future__ import annotations

import ast
import textwrap
from typing import Any, Callable


class DjactParseError(Exception):
    pass


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_and_store(block: str, component_name: str) -> str:
    """Validate the Python block and return cleaned source code.

    We do NOT exec() at parse time.  We only validate the AST and
    return normalised source that will be exec'd on the first request.
    """
    source = _normalize_indentation(block)

    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise DjactParseError(
            f"Component '{component_name}': {exc}"
        ) from exc

    _validate_ast(tree, component_name)
    return source


def compile_component(source: str, component_name: str) -> dict[str, Callable]:
    """Compile stored source into a dict of callables.

    Called lazily on the first request that hits the component.
    """
    try:
        code = compile(source, filename=f"<djact:{component_name}>", mode="exec")
    except SyntaxError as exc:
        raise DjactParseError(str(exc)) from exc

    scope: dict[str, Any] = {}
    exec(code, scope)  # noqa: S102

    funcs: dict[str, Callable] = {}
    for key, value in scope.items():
        if key.startswith("_"):
            continue
        if callable(value):
            funcs[key] = value

    if "mount" not in funcs:
        raise DjactParseError(
            f"Component '{component_name}': mount(request) must be defined."
        )

    return funcs


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_ALLOWED_NODES = (
    ast.FunctionDef,
    ast.AsyncFunctionDef,
    ast.Import,
    ast.ImportFrom,
    ast.Assign,
    ast.AnnAssign,
    ast.Expr,     # allow top-level expressions (e.g. docstrings)
)


def _validate_ast(tree: ast.Module, component_name: str) -> None:
    """Ensure only allowed top-level constructs are present."""
    for node in tree.body:
        if not isinstance(node, _ALLOWED_NODES):
            raise DjactParseError(
                f"Component '{component_name}': "
                f"Unsupported construct: {type(node).__name__}. "
                f"Only imports, functions, and assignments are allowed."
            )


def _normalize_indentation(block: str) -> str:
    """Remove common leading whitespace so template indentation
    doesn't break Python syntax."""
    return textwrap.dedent(block)

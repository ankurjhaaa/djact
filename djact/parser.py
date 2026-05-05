from __future__ import annotations

import ast
from typing import Callable, Iterable


class DjactParseError(Exception):
    pass


def extract_functions(block: str) -> dict[str, Callable]:
    normalized = _normalize_indentation(block)
    try:
        module = ast.parse(normalized)
    except SyntaxError as exc:
        raise DjactParseError(str(exc)) from exc

    funcs: dict[str, Callable] = {}
    for node in module.body:
        if not isinstance(node, ast.FunctionDef):
            raise DjactParseError("Only plain function definitions are allowed")

        if node.args.vararg or node.args.kwarg or node.args.kwonlyargs:
            raise DjactParseError("Only simple function signatures are allowed")

        # Compile the module that contains just this function for safe execution.
        func_module = ast.Module(body=[node], type_ignores=[])
        code = compile(func_module, filename="<djact>", mode="exec")
        scope: dict[str, object] = {}
        exec(code, scope)
        func_obj = scope.get(node.name)
        if not callable(func_obj):
            raise DjactParseError("Invalid function definition")
        funcs[node.name] = func_obj  # type: ignore[assignment]

    if "mount" not in funcs:
        raise DjactParseError("mount(request) must be defined")

    return funcs


def _normalize_indentation(block: str) -> str:
    """Ensure function bodies are indented even if template formatting is flat."""
    lines = block.splitlines()
    output: list[str] = []
    in_func = False

    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("def ") and stripped.endswith(":"):
            in_func = True
            output.append(stripped)
            continue

        if in_func:
            if stripped.startswith("def ") and stripped.endswith(":"):
                output.append(stripped)
                continue

            if stripped == "":
                output.append("")
                continue

            if line.startswith(" ") or line.startswith("\t"):
                output.append(line)
            else:
                output.append("    " + stripped)
        else:
            output.append(stripped)

    return "\n".join(output)

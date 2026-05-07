"""
djact.validation — Laravel-style validation for component data.

Usage:
    from djact.validation import validate

    class Component:
        def save_user(self, request, data):
            validate(data, {
                "username": "required|string|min:3|max:255",
                "email": "required|email",
            })
            # If validation fails, errors auto-return to frontend.
            # Code below this line only runs if ALL validations pass.

            User.objects.create_user(username=data["username"], email=data["email"])
            return {"username": "", "email": ""}

    Template:
        <span dj:error="username">[[ message ]]</span>
        <span dj:error="email">[[ message ]]</span>

    Custom message override (optional):
        validate(data, rules, messages={"username.required": "Bhai username daal!"})
"""
from __future__ import annotations

import re
from typing import Any


# ── Exception ────────────────────────────────────────────────────────────────

class ValidationError(Exception):
    """Raised when validate() fails. Caught by views.py automatically."""

    def __init__(self, errors: dict[str, str]):
        self.errors = errors
        super().__init__(f"Validation failed: {list(errors.keys())}")


# ── Public API ───────────────────────────────────────────────────────────────

def validate(
    data: dict[str, Any],
    rules: dict[str, str],
    messages: dict[str, str] | None = None,
) -> None:
    """Validate data against rules. Raises ValidationError if fails.

    Args:
        data: The data dict to validate.
        rules: Dict of field → pipe-separated rules.
               Example: {"username": "required|string|max:255"}
        messages: Optional custom messages (field.rule → message).

    Raises:
        ValidationError: If any validation fails.
    """
    errors = {}
    custom = messages or {}

    for field, rule_string in rules.items():
        value = data.get(field)
        rule_list = _parse_rules(rule_string)

        for rule_name, params in rule_list:
            error = _check_rule(field, value, rule_name, params, data)
            if error:
                key = f"{field}.{rule_name}"
                errors[field] = custom.get(key, error)
                break

    if errors:
        raise ValidationError(errors)


# ── Default messages ─────────────────────────────────────────────────────────

_MESSAGES = {
    "required": "The {field} field is required.",
    "string": "The {field} must be a string.",
    "numeric": "The {field} must be a number.",
    "integer": "The {field} must be an integer.",
    "boolean": "The {field} must be true or false.",
    "email": "The {field} must be a valid email address.",
    "url": "The {field} must be a valid URL.",
    "alpha": "The {field} must only contain letters.",
    "alpha_num": "The {field} must only contain letters and numbers.",
    "min": "The {field} must be at least {param} characters.",
    "max": "The {field} must not be greater than {param} characters.",
    "min_value": "The {field} must be at least {param}.",
    "max_value": "The {field} must not be greater than {param}.",
    "in": "The selected {field} is invalid.",
    "not_in": "The selected {field} is invalid.",
    "regex": "The {field} format is invalid.",
    "confirmed": "The {field} confirmation does not match.",
    "same": "The {field} and {param} must match.",
    "different": "The {field} and {param} must be different.",
    "digits": "The {field} must be {param} digits.",
    "size": "The {field} must be {param} characters.",
    "between": "The {field} must be between {param} characters.",
    "starts_with": "The {field} must start with {param}.",
    "ends_with": "The {field} must end with {param}.",
}


# ── Rule parser ──────────────────────────────────────────────────────────────

def _parse_rules(rule_string: str) -> list[tuple[str, list[str]]]:
    rules = []
    for part in rule_string.split("|"):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            name, param_str = part.split(":", 1)
            params = param_str.split(",")
        else:
            name = part
            params = []
        rules.append((name.strip(), [p.strip() for p in params]))
    return rules


# ── Rule checker ─────────────────────────────────────────────────────────────

def _check_rule(field, value, rule, params, data) -> str | None:
    checker = _RULE_MAP.get(rule)
    if not checker:
        return None
    if checker(value, params, data):
        return None
    msg = _MESSAGES.get(rule, f"The {{field}} is invalid ({rule}).")
    return msg.format(field=field.replace("_", " "), param=", ".join(params))


# ── Validators ───────────────────────────────────────────────────────────────

def _required(v, p, d):
    if v is None:
        return False
    if isinstance(v, str) and v.strip() == "":
        return False
    return True

def _string(v, p, d):
    return v is None or isinstance(v, str)

def _numeric(v, p, d):
    if v is None: return True
    if isinstance(v, (int, float)): return True
    if isinstance(v, str):
        try: float(v); return True
        except ValueError: return False
    return False

def _integer(v, p, d):
    if v is None: return True
    if isinstance(v, int) and not isinstance(v, bool): return True
    if isinstance(v, str):
        try: int(v); return True
        except ValueError: return False
    return False

def _boolean(v, p, d):
    return v is None or v in (True, False, 0, 1, "0", "1", "true", "false")

def _email(v, p, d):
    if not v: return True
    return isinstance(v, str) and bool(re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v))

def _url(v, p, d):
    if not v: return True
    return isinstance(v, str) and bool(re.match(r"^https?://[^\s/$.?#].[^\s]*$", v, re.I))

def _alpha(v, p, d):
    return not v or (isinstance(v, str) and v.isalpha())

def _alpha_num(v, p, d):
    return not v or (isinstance(v, str) and v.isalnum())

def _min(v, p, d):
    if not p or v is None: return True
    n = int(p[0])
    if isinstance(v, str): return len(v) >= n
    if isinstance(v, (int, float)): return v >= n
    if isinstance(v, (list, dict)): return len(v) >= n
    return True

def _max(v, p, d):
    if not p or v is None: return True
    n = int(p[0])
    if isinstance(v, str): return len(v) <= n
    if isinstance(v, (int, float)): return v <= n
    if isinstance(v, (list, dict)): return len(v) <= n
    return True

def _size(v, p, d):
    if not p or v is None: return True
    n = int(p[0])
    if isinstance(v, str): return len(v) == n
    if isinstance(v, (int, float)): return v == n
    if isinstance(v, (list, dict)): return len(v) == n
    return True

def _between(v, p, d):
    if len(p) < 2 or v is None: return True
    lo, hi = int(p[0]), int(p[1])
    if isinstance(v, str): return lo <= len(v) <= hi
    if isinstance(v, (int, float)): return lo <= v <= hi
    return True

def _in_list(v, p, d):
    return not v or str(v) in p

def _not_in(v, p, d):
    return not v or str(v) not in p

def _regex(v, p, d):
    if not v or not p: return True
    return bool(re.match(p[0], str(v)))

def _same(v, p, d):
    return not p or v == d.get(p[0])

def _different(v, p, d):
    return not p or v != d.get(p[0])

def _digits(v, p, d):
    if not v or not p: return True
    return isinstance(v, str) and v.isdigit() and len(v) == int(p[0])

def _starts_with(v, p, d):
    if not v or not p: return True
    return isinstance(v, str) and any(v.startswith(x) for x in p)

def _ends_with(v, p, d):
    if not v or not p: return True
    return isinstance(v, str) and any(v.endswith(x) for x in p)


# ── Map ──────────────────────────────────────────────────────────────────────

_RULE_MAP = {
    "required": _required, "string": _string, "numeric": _numeric,
    "integer": _integer, "boolean": _boolean, "email": _email,
    "url": _url, "alpha": _alpha, "alpha_num": _alpha_num,
    "min": _min, "max": _max, "size": _size, "between": _between,
    "in": _in_list, "not_in": _not_in, "regex": _regex,
    "same": _same, "different": _different, "digits": _digits,
    "starts_with": _starts_with, "ends_with": _ends_with,
}

# Djact v4.1

**File-based reactive components for Django.** No React, no Inertia — just Python classes and HTML directives.

Django renders the page normally. After that, all interactions happen via AJAX. Server returns **JSON only**. Client updates the DOM.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Component System](#component-system)
- [Directives Reference](#directives-reference)
- [Two-Way Data Binding](#two-way-data-binding)
- [Template Expressions](#template-expressions)
- [Loops and Conditionals](#loops-and-conditionals)
- [Pagination](#pagination)
- [SPA Navigation](#spa-navigation)
- [Client-Side Methods](#client-side-methods)
- [Debug Panel](#debug-panel)
- [Anti-Blink Protection](#anti-blink-protection)
- [Settings Reference](#settings-reference)
- [Architecture](#architecture)
- [Example: Full CRUD](#example-full-crud)

---

## Features

- **File-based components** — `dj:component="home"` auto-loads `components/home.py`
- **Standard Django flow** — `urls.py → views.py → render(template.html)` stays unchanged
- **Python Component class** — Clean, testable, standard Python
- **Reactive directives** — `dj:click`, `dj:submit`, `dj:model`, `dj:function`, `dj:state`
- **Template expressions** — `[[ count ]]`, `[[ user.name ]]` (no Django `{{ }}` conflict)
- **Auto-discovery** — Components found automatically from installed Django apps
- **Auto Pagination UI** — Laravel-style pagination, one-line setup
- **SPA Navigation** — `dj:navigate` for page transitions without reload
- **Debug Panel** — Next.js-style floating devtools (only in `DEBUG` mode)
- **Anti-blink protection** — No flash of unstyled content on page load
- **Zero JS to write** — Everything is declarative

---

## Installation

```bash
pip install djact
```

### 1. Add to `INSTALLED_APPS`

```python
# settings.py
INSTALLED_APPS = [
    # ...
    "djact",
]
```

### 2. Include URLs

```python
# urls.py
from django.urls import path, include

urlpatterns = [
    path("", include("djact.urls")),
    # ... your other urls
]
```

### 3. Enable Middleware

```python
# settings.py
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactAutoLoadMiddleware",
]
```

The middleware automatically:
- Detects `dj:component` or `dj:navigate` in your HTML
- Injects CSRF token, endpoint URL, and the djact client JS
- Injects anti-blink CSS (prevents flash of unstyled content)
- Injects debug meta tag when `DEBUG = True`

---

## Quick Start

### Step 1: Create a Component

```
myapp/
  components/
    __init__.py
    counter.py
```

```python
# myapp/components/counter.py

class Component:
    def mount(self, request):
        """Called on first page load. Return initial state."""
        return {"count": 0}

    def increment(self, request, data):
        """Called via dj:click. Return state updates."""
        return {"count": data["count"] + 1}

    def decrement(self, request, data):
        return {"count": data["count"] - 1}

    def reset(self, request, data):
        return {"count": 0}
```

### Step 2: Create a View (standard Django)

```python
# myapp/views.py
from django.shortcuts import render

def home(request):
    return render(request, "home.html")
```

### Step 3: Create Template

```html
<!-- myapp/templates/home.html -->
<!DOCTYPE html>
<html>
<head><title>Counter</title></head>
<body>

<div dj:component="counter" dj:state="count=0">
    <h1>Count: [[ count ]]</h1>
    <button dj:click="increment">+1</button>
    <button dj:click="decrement">-1</button>
    <button dj:click="reset">Reset</button>
</div>

</body>
</html>
```

**No JavaScript needed.** The middleware auto-injects everything.

---

## Component System

### File Structure

Components are auto-discovered from all installed Django apps:

```
myapp/
  components/
    __init__.py
    home.py               ← dj:component="home"
    counter.py            ← dj:component="counter"
    admin/
      __init__.py
      dashboard.py        ← dj:component="admin/dashboard"
      users.py            ← dj:component="admin/users"
```

### Component Class

Every component file must have a `Component` class with at least a `mount` method:

```python
class Component:
    def mount(self, request):
        """Required. Called on first page load.
        Returns the initial state dict.
        """
        return {"items": [], "name": ""}

    def add_item(self, request, data):
        """Called via dj:click or dj:submit.
        Receives current state in `data`.
        Returns state updates (merged with existing state).
        """
        items = data.get("items", [])
        items.append(data.get("name", ""))
        return {"items": items, "name": ""}

    def delete_item(self, request, data, item_id):
        """Supports extra arguments via dj:click="delete_item(item.id)".
        Arguments are passed after `data`.
        """
        items = [i for i in data["items"] if i["id"] != item_id]
        return {"items": items}
```

### Method Signatures

| Method | Signature | When Called |
|--------|-----------|------------|
| `mount` | `mount(self, request)` | First page load |
| Action | `method(self, request, data)` | `dj:click`, `dj:submit` |
| With args | `method(self, request, data, arg1, arg2)` | `dj:click="method(val1, val2)"` |
| No data | `method(self, request)` | When no state needed |

### Explicit Component Module

By default, components are auto-discovered from installed apps. You can override this:

```python
# settings.py
DJACT_COMPONENTS_MODULE = "myapp.components"
```

---

## Directives Reference

### Setup Directives

| Directive | Description | Example |
|-----------|-------------|---------|
| `dj:component="name"` | Links HTML element to a Python component | `<div dj:component="counter">` |
| `dj:state="key=val, ..."` | Initial client-side state (before mount) | `<div dj:state="count=0, name=''">` |

### Event Directives

| Directive | Description | Example |
|-----------|-------------|---------|
| `dj:click="method"` | Call server method on click | `<button dj:click="save">` |
| `dj:click="method(arg)"` | Call with arguments (evaluated from scope) | `<button dj:click="delete(user.id)">` |
| `dj:submit="method"` | Call server method on form submit | `<form dj:submit="save_user">` |
| `dj:function="setState(...)"` | Client-side state update (no server call) | `<button dj:function="setState(tab='settings')">` |

### Binding Directives

| Directive | Description | Example |
|-----------|-------------|---------|
| `dj:model="field"` | Two-way data binding for inputs | `<input dj:model="username">` |

### Rendering Directives

| Directive | Description | Example |
|-----------|-------------|---------|
| `dj:for="item in list"` | Loop — repeat element for each item | `<tr dj:for="user in users">` |
| `dj:if="condition"` | Conditional — show/hide based on expression | `<div dj:if="error">` |
| `dj:empty="list"` | Show only when list is empty | `<p dj:empty="users">No users.</p>` |
| `dj:paginate="list"` | Auto-generate pagination UI | `<div dj:paginate="users">` |

### Navigation Directives

| Directive | Description | Example |
|-----------|-------------|---------|
| `dj:navigate="/url"` | SPA navigation without full reload | `<a dj:navigate="/dashboard">` |

---

## Two-Way Data Binding

`dj:model` creates a live connection between an input and the state:

```html
<input dj:model="username" placeholder="Type here...">
<p>You typed: [[ username ]]</p>
```

Supports:
- `<input type="text">` — binds `.value`
- `<input type="checkbox">` — binds `.checked`
- `<textarea>` — binds `.value`
- `<select>` — binds `.value`

---

## Template Expressions

Use `[[ expression ]]` (double square brackets) to render dynamic values:

```html
<h1>[[ title ]]</h1>
<p>[[ user.name ]] has [[ user.posts.length ]] posts</p>
<span>[[ count > 0 ? 'Active' : 'Empty' ]]</span>
<p>[[ price * quantity ]]</p>
```

Supported operators:
- **Arithmetic**: `+`, `-`, `*`, `/`
- **Comparison**: `==`, `!=`, `>`, `<`, `>=`, `<=`
- **Logical**: `&&`, `||`, `!`
- **Ternary**: `condition ? yes : no`
- **Dot paths**: `user.name`, `item.category.title`
- **Properties**: `.length` on arrays and strings

> **Note:** Uses `[[ ]]` instead of `{{ }}` to avoid conflict with Django's template engine.

---

## Loops and Conditionals

### dj:for

```html
<table>
    <tr dj:for="user in users">
        <td>[[ user.username ]]</td>
        <td>[[ user.email ]]</td>
        <td>[[ $index ]]</td>  <!-- 0-based index -->
    </tr>
</table>
```

Inside loops, you can access:
- `user` — the current item
- `$index` — the 0-based loop index
- All parent state variables

### dj:if

```html
<div dj:if="error" class="alert">[[ error ]]</div>
<div dj:if="users.length > 0">Found [[ users.length ]] users</div>
<div dj:if="!loading">Content loaded</div>
```

### dj:empty

```html
<p dj:empty="users">No users found. Create one above.</p>
```

Shows only when the referenced list has zero items.

---

## Pagination

### Server-Side Pagination (Recommended)

Use the built-in `paginate()` helper:

```python
from djact.pagination import paginate
from django.contrib.auth.models import User

class Component:
    def mount(self, request):
        users = paginate(User.objects.all(), request, 10)
        return {"users": users}

    def change_page(self, request, data):
        users = paginate(User.objects.all(), request, 10)
        return {"users": users}
```

```html
<div dj:component="users">
    <table>
        <tr dj:for="user in users">
            <td>[[ user.username ]]</td>
            <td>[[ user.email ]]</td>
        </tr>
    </table>
    <p dj:empty="users">No users found.</p>

    <!-- Auto-generates Laravel-style pagination UI -->
    <div dj:paginate="users"></div>
</div>
```

**That's it.** One function call, one HTML line. The pagination UI is automatically generated with:
- Previous/Next buttons
- Page numbers with smart windowing (1 ... 4 5 6 ... 20)
- Active page highlight
- "Showing X to Y of Z" info text
- Full-width layout with flat, clean design

### `paginate()` Function

```python
from djact.pagination import paginate

result = paginate(queryset, page, per_page)
```

| Argument | Type | Description |
|----------|------|-------------|
| `queryset` | QuerySet or list | The data to paginate |
| `page` | int or HttpRequest | Page number, or request object (auto-extracts page) |
| `per_page` | int | Items per page (default: 10) |

When you pass a `request` object, the function automatically extracts `__page` from the POST body (sent by the pagination UI).

Returns:
```python
{
    "data": [...],          # Items for current page
    "current_page": 1,      # Current page number
    "last_page": 5,          # Total number of pages
    "per_page": 10,          # Items per page
    "total": 47,             # Total item count
}
```

### Pagination Theme

Auto-detects system theme (light/dark). Override manually:

```html
<div dj:paginate="users" dj:paginate.mode="dark"></div>
<div dj:paginate="users" dj:paginate.mode="light"></div>
```

### Client-Side Pagination

For small lists already in state, paginate on the client:

```html
<div dj:for="item in items">...</div>
<div dj:paginate="items" dj:per-page="5"></div>
```

No server calls — pagination happens in the browser.

---

## SPA Navigation

Navigate between pages without full page reload:

```html
<nav>
    <a dj:navigate="/">Home</a>
    <a dj:navigate="/dashboard">Dashboard</a>
    <a dj:navigate="/settings">Settings</a>
</nav>
```

### How It Works

1. Click intercepted — no full page reload
2. Progress bar shown at top of page
3. New page fetched via `fetch()`
4. `<body>` content replaced
5. All djact components re-initialized
6. Debug panel preserved
7. Browser URL updated (back/forward works)

### Fallback

If the fetch fails (network error, 500, etc.), falls back to a normal full page reload.

### Link Color

Default color: `#3b82f6` (blue). Override in settings:

```python
# settings.py
NAVIGATE_COLOR = "#ff0000"
```

---

## Client-Side Methods

`dj:function` runs logic on the client without a server call:

```html
<!-- Set state directly -->
<button dj:function="setState(tab='profile')">Profile</button>
<button dj:function="setState(tab='settings')">Settings</button>

<!-- Use in loops (accesses loop scope) -->
<tr dj:for="user in users">
    <td>[[ user.name ]]</td>
    <td>
        <button dj:function="setState(editing_id=user.id, username=user.username)">
            Edit
        </button>
    </td>
</tr>
```

`setState()` merges updates into the current state and re-renders the DOM immediately.

---

## Debug Panel

Automatically appears when Django `DEBUG = True`. A floating ⚡ button appears in the bottom-right corner.

### Features

- **Draggable** — drag the button anywhere on screen
- **Request Inspector** — shows every server call with:
  - Component name
  - Method name
  - HTTP status
  - Latency (ms)
  - Full request/response JSON (expandable)
- **Error Tracking** — catches:
  - Django server errors
  - JavaScript errors
  - Network failures
  - Unhandled promise rejections
- **Activity Logs** — timeline of all actions
- **Survives Navigation** — stays active across `dj:navigate` page transitions

### Activation

No configuration needed. Only enabled when:

```python
# settings.py
DEBUG = True
```

In production (`DEBUG = False`), the debug panel is completely absent — no JS loaded, no DOM elements, no overhead.

---

## Anti-Blink Protection

When a page loads, elements with `dj:if`, `dj:for`, and `dj:empty` are hidden by CSS **before** JavaScript runs. This prevents the "flash of unstyled content" where:

- A `dj:if="error"` div briefly flashes before being hidden
- Template text like `[[ user.name ]]` shows as literal text
- Loop templates show before being cloned

The middleware injects:
```html
<style id="djact-anti-blink">
  [dj\:if],[dj\:empty],[dj\:for]{display:none!important}
</style>
```

This style is automatically removed once all components have finished their `mount()` call and rendered properly.

---

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `DEBUG` | `False` | Enables debug panel when `True` |
| `DJACT_ENDPOINT_URL` | Auto-resolved | Override the AJAX endpoint URL |
| `DJACT_COMPONENTS_MODULE` | `None` | Explicit component module path (e.g. `"myapp.components"`) |
| `NAVIGATE_COLOR` | `#3b82f6` | Link color for `dj:navigate` elements |

---

## Architecture

### How It Works

```
1. Django View renders HTML normally
   urls.py → views.py → render("template.html")

2. Middleware detects dj:component in response
   → Injects: CSRF meta, endpoint URL meta, anti-blink CSS, auto.js

3. Client JS boots (auto.js)
   → Parses dj:state for initial state
   → Calls mount() on server via POST /djact/

4. Server loads Component class via importlib
   → Calls mount(self, request)
   → Returns JSON state dict

5. Client renders DOM
   → [[ expressions ]] interpolated
   → dj:for loops unrolled
   → dj:if conditions evaluated
   → Anti-blink CSS removed

6. User interacts (dj:click, dj:submit, dj:model)
   → POST /djact/ with {component, method, data}
   → Server calls method, returns JSON
   → Client merges state and re-renders DOM
```

### Package Structure

```
djact/
├── __init__.py          # v4.1.0, exports djact_endpoint + paginate
├── apps.py              # Django app config
├── loader.py            # importlib component auto-discovery
├── middleware.py         # Asset injection + anti-blink
├── pagination.py        # paginate() helper
├── urls.py              # POST /djact/ endpoint
├── views.py             # JSON endpoint handler
├── py.typed             # PEP 561 marker
└── static/djact/
    ├── auto.js           # Entry point (bootstraps everything)
    ├── core.js           # Component lifecycle + state management
    ├── api.js            # fetch() wrapper + debug hooks
    ├── renderer.js       # DOM rendering engine
    ├── renderer_expr.js  # Safe expression evaluator (no eval)
    ├── directives.js     # Event binding (click, submit, model)
    ├── state.js          # State string parser
    ├── paginate.js       # Pagination UI generator
    ├── navigate.js       # SPA navigation
    └── debug.js          # DevTools panel
```

### Single Endpoint

All server calls go through one POST endpoint:

```
POST /djact/
Content-Type: application/json

{
    "component": "users",
    "method": "save_user",
    "data": { "username": "john", "email": "john@example.com" }
}

Response: { "users": [...], "username": "", "email": "" }
```

---

## Example: Full CRUD

### Component

```python
# myapp/components/users.py
from django.contrib.auth.models import User
from djact.pagination import paginate

class Component:
    def mount(self, request):
        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {
            "users": users,
            "username": "",
            "email": "",
            "editing_id": None,
            "error": "",
        }

    def save_user(self, request, data):
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        editing_id = data.get("editing_id")

        if not username:
            return {"error": "Username is required!"}

        if editing_id:
            user = User.objects.get(id=editing_id)
            user.username = username
            user.email = email
            user.save()
        else:
            User.objects.create_user(username=username, email=email)

        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {
            "users": users,
            "username": "",
            "email": "",
            "editing_id": None,
            "error": "",
        }

    def delete_user(self, request, data, user_id):
        User.objects.filter(id=user_id).delete()
        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {"users": users}

    def change_page(self, request, data):
        users = paginate(User.objects.all().order_by("-id"), request, 10)
        return {"users": users}
```

### Template

```html
<div dj:component="users" dj:state="users=[], username='', email='', editing_id=null, error=''">

    <!-- Error message -->
    <div dj:if="error" style="color:red; padding:8px; margin-bottom:12px">
        [[ error ]]
    </div>

    <!-- Form -->
    <form dj:submit="save_user" style="display:flex; gap:8px; margin-bottom:16px">
        <input dj:model="username" placeholder="Username" required>
        <input dj:model="email" type="email" placeholder="Email">
        <button type="submit">Save</button>
    </form>

    <!-- Table -->
    <table width="100%">
        <thead>
            <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            <tr dj:for="user in users">
                <td>[[ user.id ]]</td>
                <td>[[ user.username ]]</td>
                <td>[[ user.email ]]</td>
                <td>
                    <button dj:function="setState(editing_id=user.id, username=user.username, email=user.email)">
                        Edit
                    </button>
                    <button dj:click="delete_user(user.id)">
                        Delete
                    </button>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- Empty state -->
    <p dj:empty="users" style="text-align:center; color:#888">
        No users found. Create one above.
    </p>

    <!-- Pagination -->
    <div dj:paginate="users"></div>
</div>
```

---

## License

MIT

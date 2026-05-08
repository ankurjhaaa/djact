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
- [Validation](#validation)
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
- **Auto Pagination** — Laravel-style pagination, one-line setup, no `change_page` needed
- **Laravel Validation** — `required|email|min:3|max:255` with custom messages
- **Error Display** — `dj:error="field"` shows validation errors inline
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

| `mount` | `mount(self, request)` | First page load + pagination |
| `mount` (with data) | `mount(self, request, data)` | Receives initial `dj:state` |
| Action | `method(self, request, data)` | `dj:click`, `dj:submit` |
| With args | `method(self, request, data, arg1, arg2)` | `dj:click="method(val1, val2)"` |
| No data | `method(self, request)` | When no state needed |

### Dynamic URL Parameters (Django Routes)

To pass dynamic data from a Django URL route (like `<int:id>` or `<str:slug>`) into a component, you simply pass it to the template and render it into `dj:state`. Then your `mount` function can catch it using `data`.

#### Example 1: Passing a Single ID (User Profile)

**1. Django View (`views.py`)**
```python
def user_profile(request, user_id):
    # Pass URL param to the template context
    return render(request, "profile.html", {"user_id": user_id})
```

**2. Template (`profile.html`)**
```html
<!-- Inject the Django variable into dj:state -->
<div dj:component="profile" dj:state="user_id={{ user_id }}">
    <h1>[[ username ]]</h1>
</div>
```

**3. Component (`components/profile.py`)**
```python
class Component:
    def mount(self, request, data):
        # 'data' automatically receives the parsed dj:state
        user_id = data.get("user_id") 
        user = User.objects.get(id=user_id)
        
        return {"username": user.username}
```

#### Example 2: Passing Multiple Parameters (Strings & IDs)

You can pass as many variables as you want, including strings. Just make sure to wrap strings in quotes (`'{{ string_var }}'`) inside the `dj:state` string.

**1. Django View (`views.py`)**
```python
def product_list(request, category, status_id):
    return render(request, "products.html", {
        "category": category,   # e.g., "electronics"
        "status_id": status_id  # e.g., 2
    })
```

**2. Template (`products.html`)**
```html
<!-- Strings need quotes, integers do not -->
<div dj:component="products" dj:state="category='{{ category }}', status_id={{ status_id }}">
    <h2>Category: [[ category ]]</h2>
    <div dj:for="item in items">...</div>
</div>
```

**3. Component (`components/products.py`)**
```python
class Component:
    def mount(self, request, data):
        # Read both parameters passed from the URL
        category = data.get("category")
        status_id = data.get("status_id")
        
        # Filter database based on URL parameters
        items = Product.objects.filter(category=category, status=status_id)
        
        return {
            "category": category,
            "items": [i.to_dict() for i in items]
        }
```

This approach is highly scalable and works perfectly with `dj:navigate` for seamless SPA transitions!

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
| `dj:error="field"` | Show validation error for a field | `<span dj:error="username">[[ message ]]</span>` |
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

### Server-Side Pagination

Use the built-in `paginate()` helper. No `change_page` method needed — it's fully automatic:

```python
from djact.pagination import paginate
from django.contrib.auth.models import User

class Component:
    def mount(self, request):
        users = paginate(User.objects.all(), request, 10)
        return {"users": users}

    def delete_user(self, request, data, user_id):
        User.objects.filter(id=user_id).delete()
        # Automatically stays on current page!
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

**How it works:**
- Page change clicks automatically call `mount()` with `__page` in request
- `paginate(queryset, request, per_page)` extracts page automatically
- When deleting/saving from page 5, current page is preserved from state
- If items on current page are gone, it auto-clamps to last valid page

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

### Custom Pagination Method

By default, page changes call `mount()`. To use a custom method:

```html
<div dj:paginate="users" dj:paginate.method="load_users"></div>
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

## Validation

### Basic Usage

Just call `validate()` — if validation fails, errors are **auto-returned** to the frontend. No `if` check needed:

```python
from djact.validation import validate

class Component:
    def save_user(self, request, data):
        validate(data, {
            "username": "required|string|min:3|max:150",
            "email": "required|email|max:255",
        })

        # This code ONLY runs if validation passes ↑
        User.objects.create_user(username=data["username"], email=data["email"])
        return {"username": "", "email": "", "errors": {}}
```

How it works:
1. `validate()` checks all rules
2. If any rule fails → raises `ValidationError`
3. `views.py` auto-catches it → returns `{"errors": {"username": "The username field is required."}}` to frontend
4. `dj:error="username"` shows the message in HTML

**Default error messages are built-in.** You don't need to write custom messages.

### Custom Messages (Optional)

If you want to override default messages, pass a `messages` dict:

```python
validate(data, {
    "username": "required|string|min:3",
    "email": "required|email",
}, messages={
    "username.required": "Bhai username daal!",
    "email.email": "Ye email nahi hai!",
})
```

But this is **optional** — default messages like `"The username field is required."` work out of the box.

### Displaying Errors in HTML

Use `dj:error="fieldname"` — it auto-hides/shows based on `state.errors`:

```html
<form dj:submit="save_user">
    <input dj:model="username" placeholder="Username">
    <span dj:error="username" style="color:red">[[ message ]]</span>

    <input dj:model="email" type="email" placeholder="Email">
    <span dj:error="email" style="color:red">[[ message ]]</span>

    <button type="submit">Save</button>
</form>
```

- **`[[ message ]]`** — shows the default error message from the package
- **Custom text** — write your own text instead of `[[ message ]]`:

```html
<span dj:error="username" style="color:red">Username galat hai!</span>
```

### Available Rules

| Rule | Description | Example |
|------|-------------|---------|
| `required` | Field must be present and non-empty | `"required"` |
| `string` | Must be a string | `"string"` |
| `numeric` | Must be a number | `"numeric"` |
| `integer` | Must be an integer | `"integer"` |
| `boolean` | Must be true/false | `"boolean"` |
| `email` | Must be valid email format | `"email"` |
| `url` | Must be valid URL | `"url"` |
| `alpha` | Only letters | `"alpha"` |
| `alpha_num` | Only letters and numbers | `"alpha_num"` |
| `min:N` | Min length (string) or min value (number) | `"min:3"` |
| `max:N` | Max length (string) or max value (number) | `"max:255"` |
| `size:N` | Exact length/value | `"size:10"` |
| `between:min,max` | Length/value between min and max | `"between:3,20"` |
| `in:a,b,c` | Must be one of listed values | `"in:admin,user,editor"` |
| `not_in:a,b,c` | Must NOT be one of listed values | `"not_in:banned,deleted"` |
| `regex:pattern` | Must match regex pattern | `"regex:^[A-Z]"` |
| `digits:N` | Must be exactly N digits | `"digits:10"` |
| `same:field` | Must match another field | `"same:password"` |
| `different:field` | Must differ from another field | `"different:old_password"` |
| `starts_with:prefix` | Must start with given prefix | `"starts_with:+91"` |
| `ends_with:suffix` | Must end with given suffix | `"ends_with:.com"` |

### Combining Rules

Rules are pipe-separated `|` and checked in order. First failing rule produces the error:

```python
"username": "required|string|alpha_num|min:3|max:50"
"password": "required|string|min:8|max:128"
"phone": "required|digits:10"
"website": "url|max:500"
"role": "required|in:admin,user,moderator,editor"
```

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
  - Component name, method name
  - HTTP status, latency (ms)
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

When a page loads, the entire `dj:component` content is hidden (opacity: 0) until the component's `mount()` call completes. This prevents:

- Template text like `[[ user.name ]]` showing as literal text
- `dj:if="error"` divs briefly flashing before being hidden
- Loop templates showing before being cloned

The middleware injects:
```html
<style id="djact-anti-blink">
  [dj\:component]:not([data-dj-ready]){opacity:0!important}
  [dj\:if],[dj\:empty],[dj\:for],[dj\:error]{display:none!important}
</style>
```

After `mount()` returns and the DOM is rendered:
1. Component gets `data-dj-ready` attribute → becomes visible
2. All directive elements are properly shown/hidden by JS

**Zero configuration needed.** Works automatically on every page.

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
   → Component hidden (opacity:0)
   → Calls mount() on server via POST /djact/

4. Server loads Component class via importlib
   → Calls mount(self, request)
   → Returns JSON state dict

5. Client renders DOM
   → [[ expressions ]] interpolated
   → dj:for loops unrolled
   → dj:if / dj:error evaluated
   → Component becomes visible (data-dj-ready)

6. User interacts (dj:click, dj:submit, dj:model)
   → POST /djact/ with {component, method, data}
   → Server calls method, returns JSON
   → Client merges state and re-renders DOM
```

### Package Structure

```
djact/
├── __init__.py          # v4.1.2, exports djact_endpoint + paginate + validate
├── apps.py              # Django app config
├── loader.py            # importlib component auto-discovery
├── middleware.py         # Asset injection + anti-blink
├── pagination.py        # paginate() helper
├── validation.py        # Laravel-style validate() helper
├── urls.py              # POST /djact/ endpoint
├── views.py             # JSON endpoint handler
├── py.typed             # PEP 561 marker
└── static/djact/
    ├── auto.js           # Entry point (bootstraps everything)
    ├── core.js           # Component lifecycle + state management
    ├── api.js            # fetch() wrapper + debug hooks
    ├── renderer.js       # DOM rendering engine (for, if, error, paginate)
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

Response: { "users": {...}, "username": "", "email": "", "errors": {} }
```

---

## Example: Full CRUD

### Component

```python
# myapp/components/users.py
from django.contrib.auth.models import User
from djact.pagination import paginate
from djact.validation import validate

class Component:
    def mount(self, request):
        return {
            "users": paginate(User.objects.all().order_by("-id"), request, 10),
            "username": "",
            "email": "",
            "editing_id": None,
            "errors": {},
        }

    def save_user(self, request, data):
        validate(data, {
            "username": "required|string|min:3|max:150",
            "email": "required|email|max:255",
        })

        # Only runs if validation passes ↑
        editing_id = data.get("editing_id")
        if editing_id:
            user = User.objects.get(id=editing_id)
            user.username = data["username"].strip()
            user.email = data["email"].strip()
            user.save()
        else:
            User.objects.create_user(
                username=data["username"].strip(),
                email=data["email"].strip(),
            )

        return {
            "users": paginate(User.objects.all().order_by("-id"), request, 10),
            "username": "",
            "email": "",
            "editing_id": None,
            "errors": {},
        }

    def delete_user(self, request, data, user_id):
        User.objects.filter(id=user_id).delete()
        return {"users": paginate(User.objects.all().order_by("-id"), request, 10)}
```

### Template

```html
<div dj:component="users" dj:state="users=[], username='', email='', editing_id=null, errors={}">

    <!-- Form -->
    <form dj:submit="save_user" style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap">
        <div>
            <input dj:model="username" placeholder="Username" required>
            <span dj:error="username" style="color:red; font-size:12px; display:block">[[ message ]]</span>
        </div>
        <div>
            <input dj:model="email" type="email" placeholder="Email">
            <span dj:error="email" style="color:red; font-size:12px; display:block">[[ message ]]</span>
        </div>
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

    <!-- Pagination (auto — no change_page method needed) -->
    <div dj:paginate="users"></div>
</div>
```

---

## License

MIT

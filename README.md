# Djact v4.0

**File-based reactive components for Django.** No React, no Inertia — just Python classes and HTML directives.

Django renders the page normally. After that, all interactions happen via AJAX. Server returns JSON only. Client updates the DOM.

---

## Features

- **File-based components** — `dj:component="home"` auto-loads `components/home.py`
- **Standard Django flow** — `urls.py → views.py → render(template.html)` stays unchanged
- **Python Component class** — Clean, testable, standard Python
- **Reactive directives** — `dj:click`, `dj:submit`, `dj:model`, `dj:function`, `dj:state`
- **Template expressions** — `[[ count ]]`, `[[ user.name ]]` (no Django `{{ }}` conflict)
- **Auto-discovery** — Components found automatically from installed apps
- **Zero JS to write** — Everything is declarative

---

## Installation

```bash
pip install djact
```

### 1. Add to `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # ...
    "djact",
]
```

### 2. Include URLs

```python
from django.urls import path, include

urlpatterns = [
    path("", include("djact.urls")),
]
```

### 3. Enable Middleware

```python
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactAutoLoadMiddleware",
]
```

---

## Quick Start

### Step 1: Create a Component

```
myapp/
  components/
    __init__.py
    counter.py        ← dj:component="counter"
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
```

### Step 2: Create Template

```python
# myapp/views.py
from django.shortcuts import render

def home(request):
    return render(request, "home.html")
```

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
</div>

</body>
</html>
```

That's it. No JavaScript needed.

---

## Directives

| Directive | Type | Description |
|-----------|------|-------------|
| `dj:component="name"` | Setup | Links HTML to a Python component |
| `dj:state="key=val, ..."` | Setup | Initial client-side state |
| `dj:click="method"` | Event | Calls server method on click |
| `dj:click="method(arg)"` | Event | Calls with arguments |
| `dj:submit="method"` | Event | Calls server method on form submit |
| `dj:function="setState(...)"` | Event | Client-side state update (no server call) |
| `dj:model="field"` | Binding | Two-way data binding for inputs |
| `dj:for="item in list"` | Loop | Repeat element for each item |
| `dj:if="condition"` | Condition | Show/hide based on expression |
| `dj:empty="list"` | Condition | Show only if list is empty |
| `dj:paginate="list"` | Pagination | Auto pagination controls |

---

## Component File Structure

Components are auto-discovered from installed apps:

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

```python
class Component:
    def mount(self, request):
        """Required. Returns initial state dict."""
        return {"items": [], "name": ""}

    def any_method(self, request, data):
        """Called via dj:click or dj:submit. Returns state updates."""
        return {"items": data["items"] + [data["name"]]}

    def delete(self, request, data, item_id):
        """Supports extra arguments: dj:click="delete(item.id)" """
        items = [i for i in data["items"] if i["id"] != item_id]
        return {"items": items}
```

---

## CRUD Example

```python
# myapp/components/users.py
from django.contrib.auth.models import User

class Component:
    def mount(self, request):
        users = list(User.objects.values("id", "username", "email")[:50])
        return {"users": users, "username": "", "email": "", "editing_id": None, "error": ""}

    def save_user(self, request, data):
        username = data.get("username", "")
        if not username:
            return {"error": "Username is required!"}
        User.objects.create_user(username=username, email=data.get("email", ""))
        users = list(User.objects.values("id", "username", "email")[:50])
        return {"users": users, "username": "", "email": "", "error": ""}

    def delete_user(self, request, data, user_id):
        User.objects.filter(id=user_id).delete()
        users = list(User.objects.values("id", "username", "email")[:50])
        return {"users": users}
```

```html
<div dj:component="users" dj:state="users=[], username='', email='', editing_id=null, error=''">

    <div dj:if="error" style="color:red">[[ error ]]</div>

    <form dj:submit="save_user">
        <input dj:model="username" placeholder="Username">
        <input dj:model="email" placeholder="Email">
        <button type="submit">Save</button>
    </form>

    <table>
        <tr dj:for="user in users">
            <td>[[ user.username ]]</td>
            <td>[[ user.email ]]</td>
            <td><button dj:click="delete_user(user.id)">Delete</button></td>
        </tr>
    </table>

    <p dj:empty="users">No users yet.</p>
</div>
```

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `DJACT_ENDPOINT_URL` | Auto-resolved | Override the AJAX endpoint URL |
| `DJACT_COMPONENTS_MODULE` | None | Explicit module path (e.g. `"myapp.components"`) |

---

## How It Works

1. Django renders HTML normally (standard `urls.py → views.py → template`)
2. Middleware detects `dj:component` in the response and injects CSRF + JS assets
3. Client JS (`auto.js`) boots: parses `dj:state`, calls `mount()` on server
4. Server loads `Component` class via `importlib`, calls `mount()`, returns JSON
5. Client updates DOM using `[[ expression ]]` interpolation
6. User interactions (`dj:click`, `dj:submit`) send AJAX POST → server method → JSON → DOM update

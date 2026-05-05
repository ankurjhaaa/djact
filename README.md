# Djact

Djact is a lightweight HTML-first interaction system for Django. It is **not** React, **not** Inertia, and **not** Livewire. The server returns JSON only, and the client updates the DOM.

## Why Djact

- Write backend logic and HTML in the **same template**.
- Simple directives like `dj:click` and `dj:submit`.
- No HTML re-rendering from server.
- A tiny client runtime that updates DOM based on state.

## Installation

```bash
pip install djact
```

## Quick Start

### 1) Add `djact` to `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # ...
    "djact",
]
```

### 2) Include Djact URLs

```python
from django.urls import path, include

urlpatterns = [
    # ...
    path("", include("djact.urls")),
]
```

### 3) Enable auto-loading for .dj.html

Add the middleware so Djact assets auto-load for templates ending with `.dj.html`:

```python
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactAutoLoadMiddleware",
]
```

Now create templates with `.dj.html` extension, and you do NOT need to manually load JS.

### 4) Template example (home.dj.html)

```django
{% load djact %}

{% djact %}

def mount(request):
    return {
        "name": "",
        "showModal": False,
        "message": "",
    }


def increment(request, data):
    return {
        "name": "Ankur",
    }


def saveUser(request, data):
    return {
        "message": "Saved Successfully",
    }

{% enddjact %}

<div dj:state="name='', showModal=false, message=''">
    <h1>[[ name ]]</h1>

    <button dj:click="increment">Increment</button>

    <button dj:function="setState(showModal=true)">
        Open Modal
    </button>

    <form dj:submit="saveUser">
        <button type="submit">Save</button>
    </form>

    <p>[[ message ]]</p>
</div>

<script>
    window.methods = window.methods || {};
    window.methods.saveUser = async (state, setState) => {
        // client-only method example
        setState({ message: "Client Saved" });
    };
</script>
```

## Directives

### `dj:state`

Initial state for the component.

```html
<div dj:state="name='', showModal=false"></div>
```

### `dj:click`

Calls a server method.

```html
<button dj:click="increment">Increment</button>
```

### `dj:submit`

Handles form submit and calls server method.

```html
<form dj:submit="saveUser">
  <button type="submit">Save</button>
</form>
```

### `dj:function`

Calls client methods or `setState()`.

```html
<button dj:function="setState(showModal=true)">Open</button>
```

## Example Project

A minimal working page is possible with only one template and a view-less setup because Djact uses the `/djact` endpoint for actions.

## Comparison

- **Livewire**: server re-renders HTML. Djact returns JSON only.
- **HTMX**: HTML fragments. Djact uses JSON and client-side rendering.
- **Alpine**: client-only. Djact adds optional server actions.

## Folder Structure

```text
djact/
├── __init__.py
├── apps.py
├── views.py
├── parser.py
├── registry.py
├── urls.py
├── templatetags/
│   └── djact.py
├── static/
│   └── djact/
│       ├── core.js
│       ├── state.js
│       ├── renderer.js
│       ├── renderer_expr.js
│       ├── directives.js
│       └── api.js
```

## Notes

- All server responses are JSON only.
- `mount()` runs on page load.
- All methods are plain Python functions.

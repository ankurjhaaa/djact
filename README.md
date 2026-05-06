# Djact v3.0

Djact is a lightweight, Livewire-style HTML-first interaction system for Django. It is **not** React, **not** Inertia. The server returns JSON only, and the client updates the DOM.

## Features
- Write backend logic and HTML in the **same template**.
- Full support for Python imports (`from myapp.models import Task`).
- `dj:component` namespace isolation (multiple components per page).
- Two-way data binding with `dj:model`.
- Simple directives like `dj:click`, `dj:submit`, `dj:extra`.

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
    path("djact/", include("djact.urls")),
]
```

### 3) Enable Middleware

Add the middleware so Djact assets auto-load for templates ending with `.dj.html`:

```python
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactAutoLoadMiddleware",
]
```

Now create templates with `.dj.html` extension.

### 4) Template example (home.dj.html)

```django
{% load djact %}

{% djact "todo" %}
# You can import models or anything else here!
# from myapp.models import Task

def mount(request):
    return {
        "tasks": [{"id": 1, "title": "Buy Milk"}, {"id": 2, "title": "Read Book"}],
        "new_title": "",
    }

def add_task(request, data):
    new_task = {"id": len(data["tasks"]) + 1, "title": data["new_title"]}
    tasks = data["tasks"]
    tasks.append(new_task)
    return {"tasks": tasks, "new_title": ""}

def delete_task(request, data):
    task_id = data["__extra"]["id"]
    tasks = [t for t in data["tasks"] if t["id"] != task_id]
    return {"tasks": tasks}
{% enddjact %}

<div dj:component="todo">
    <h1>Todos ([[ tasks.length ]])</h1>

    <form dj:submit="add_task">
        <input dj:model="new_title" placeholder="New task..." />
        <button type="submit">Add</button>
    </form>

    <ul>
        <li dj:for="task in tasks">
            [[ task.title ]] 
            <button dj:click="delete_task" dj:extra="id=task.id">Delete</button>
        </li>
    </ul>

    <p dj:empty="tasks">No tasks yet!</p>
</div>
```

## Directives

- `dj:component="name"`: Links a DOM tree to a named Python component. Replaces `dj:state`.
- `dj:model="field"`: Two-way data binding for inputs.
- `dj:click="method"`: Calls a server method.
- `dj:submit="method"`: Calls a server method on form submit.
- `dj:extra="key=value"`: Passes extra payload data to the server.
- `dj:for="item in list"`: Repeats an element.
- `dj:if="condition"`: Conditionally toggles display.
- `dj:empty="list"`: Shows only if the list is empty.
- `dj:paginate="list"`: Automatically handles pagination limits.

## Notes

- `mount()` is mandatory for every component.
- The Python code inside `{% djact %}` runs at request time with access to the full Django environment.

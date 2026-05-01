# Djact

Djact is a minimal Django + React bridge (Inertia-like). First request returns HTML, next requests return JSON and React swaps components.

## Install

```bash
pip install djact
```

## Minimal setup (Django)

### 1) Add only Djact in `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # keep your existing apps
    "djact",
]
```

> Note: if your project already uses Django static files, keep `django.contrib.staticfiles`. Djact does not require any extra third-party app besides itself.

### 2) Add middleware (required for redirects/shared props)

```python
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactMiddleware",
]
```

### 3) Use `djact_render()` in views

```python
from djact.render import djact_render

def home(request):
    return djact_render(request, "Home", {"message": "Hello"})
```

### 4) URLs

```python
from django.urls import path
from .views import home

urlpatterns = [
    path("", home, name="home"),
]
```

## React setup (very short)

You only need a single build output: `djact/static/app.js`.

### One-time npm install

```bash
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react
```

### `vite.config.js`

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "./djact/static",
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "app.js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
```

### `src/main.js`

```javascript
import { bootstrap } from "../djact/djact/index.js";
bootstrap();
```

### Build

```bash
npx vite build
```

## How rendering works

1. Django view calls `djact_render()`.
2. Server builds payload: `component`, `props`, `url`.
3. HTML shell is returned once with `data-page`.
4. Client runtime reads `data-page`, mounts React.
5. Next navigation sends `X-Djact: true` and gets JSON.
6. React swaps the component without full page reload.

## Passing data

```python
return djact_render(request, "Home", {"user": "Ankur"})
```

### Shared data for every page

```python
request.djact.share("authUser", {"name": "Ankur"})
```

## Login redirect issue (fixed by middleware)

If login redirects are not working during Djact navigation:

1) Make sure `DjactMiddleware` is enabled.
2) Use normal Django `redirect()` in login views.
3) Use `Link` or `djactVisit()` in React so `X-Djact` is sent.

## Package layout (inside this package)

```text
djact/
├── djact/
│   ├── __init__.py
│   ├── apps.py
│   ├── middleware.py
│   ├── render.py
│   ├── utils.py
│   ├── static/
│   │   └── app.js
│   ├── templates/
│   │   └── djact.html
│   └── djact/
│       ├── App.jsx
│       └── index.js
├── pyproject.toml
└── README.md
```

## Run

```bash
python manage.py runserver
```

Open: http://127.0.0.1:8000/

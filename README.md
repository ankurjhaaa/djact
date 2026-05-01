# Djact

Djact is a minimal Django + React bridge. It lets Django render the first HTML page and lets React handle fast navigation afterward without a REST API.

## Package name

```bash
pip install djact
```

## Supports

- Python: 3.10+
- Django: 4.x and 5.x (package requirement is Django >= 4.0)
- React: 18+

## Final folder structure (inside this package)

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

## What each file does

- `djact/render.py` — server helper `djact_render()`.
- `djact/middleware.py` — attaches `request.is_djact` and `request.djact`.
- `djact/utils.py` — helpers (header detection and CSRF).
- `djact/templates/djact.html` — HTML shell with `#app` mount point.
- `djact/static/app.js` — client runtime (ES module).
- `djact/djact/App.jsx` — example React component.
- `djact/djact/index.js` — example resolver + bootstrap.

## Step-by-step setup (Django project)

### 1) Install package

```bash
pip install djact
```

### 2) Add app + middleware in settings

```python
INSTALLED_APPS = [
    # ...
    "django.contrib.staticfiles",
    "djact",
]

MIDDLEWARE = [
    # ...
    "djact.middleware.DjactMiddleware",
]
```

### 3) Create a Django view

```python
from djact.render import djact_render

def home(request):
    return djact_render(request, "Home", {"message": "Hello from Django"})
```

### 4) URL routing

```python
from django.urls import path
from .views import home

urlpatterns = [
    path("", home, name="home"),
]
```

### 5) Template behavior (no extra work needed)

- `djact/templates/djact.html` is used by `djact_render()`.
- It renders `<div id="app" data-page="...">` where JSON is embedded.
- It loads the client runtime via `{% static 'app.js' %}`.

### 6) Frontend example files

- Example React code is already at `djact/djact/`.
- `App.jsx` is a minimal component.
- `index.js` shows `resolve()` and `bootstrap()`.

You can replace these with your own pages later.

## React setup (minimal npm)

You must bundle React into `djact/static/app.js`.

### Option A: Vite (recommended)

```bash
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react
```

Create `vite.config.js`:

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

Example entry `src/main.js`:

```javascript
import { bootstrap } from "../djact/djact/index.js";
bootstrap();
```

Build:

```bash
npx vite build
```

### Option B: Any bundler

- Output must be `djact/static/app.js`.
- Template already loads `{% static 'app.js' %}`.

## How render + data flow works

1. Django view calls `djact_render()`.
2. Server builds payload:
   - `component` (string name)
   - `props` (data dict)
   - `url` (current path)
3. First load returns full HTML shell.
4. Payload is embedded in `data-page`.
5. Client runtime reads `data-page` and mounts React.
6. Next navigation sends `X-Djact: true`.
7. Server returns JSON and the client swaps the component.

## Passing data

```python
return djact_render(request, "Home", {"user": "Ankur", "count": 12})
```

### Shared props for every page

```python
request.djact.share("authUser", {"name": "Ankur"})
```

## Login redirect problem (common issue) and fix

If login or auth redirect is not working in Djact navigation:

- The middleware adds `X-Djact-Location` on redirects for Djact requests.
- The client runtime listens to redirects and does a hard reload when needed.

Make sure:

1) You are using `DjactMiddleware`.
2) Django login view returns a normal redirect (e.g. `return redirect("/")`).
3) Your frontend uses `Link` or `djactVisit()` so `X-Djact` header is sent.

If login still fails, share the error log and I will fix it.

## Run Django

```bash
python manage.py runserver
```

Open: http://127.0.0.1:8000/

## Final checklist

- [ ] `djact` installed
- [ ] `DjactMiddleware` enabled
- [ ] `djact_render()` used in views
- [ ] `djact/static/app.js` built
- [ ] Template loads and React mounts

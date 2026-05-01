# Djact

Djact is a minimal Django + React bridge (Inertia-like). It returns HTML on the first visit and JSON on subsequent visits. React mounts once and swaps components without a full page reload.

This README is intentionally detailed and step-by-step so you can publish and set up with no missing steps.

---

## 1) Install the package

```bash
pip install djact
```

---

## 2) What Djact needs in your Django project

Djact only needs:

- `djact` in `INSTALLED_APPS`
- `DjactMiddleware` in `MIDDLEWARE`
- A view that calls `djact_render()`
- A React bundle built to `djact/static/app.js`

Nothing else is required by Djact.

---

## 3) Django settings (exact steps)

Open your Django project's `settings.py` and update these sections.

### 3.1 `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # keep your existing apps
    "djact",
]
```

If your project already uses static files, you can keep `django.contrib.staticfiles` as usual.

### 3.2 `MIDDLEWARE`

```python
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactMiddleware",
]
```

### 3.3 `TEMPLATES`

Make sure `APP_DIRS` is `True` so Django can load the template shipped with the package.

```python
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]
```

### 3.4 `STATIC_URL`

```python
STATIC_URL = "/static/"
```

If you already have static settings, keep them as they are.

---

## 4) Django view (render step)

Create a view that returns a Djact page.

```python
from djact.render import djact_render

def home(request):
    return djact_render(request, "Home", {"message": "Hello from Django"})
```

This view sends:

- `component`: the string name (here `"Home"`)
- `props`: the data dict
- `url`: current path

---

## 5) Django URLs

```python
from django.urls import path
from .views import home

urlpatterns = [
    path("", home, name="home"),
]
```

---

## 6) HTML template and static files (where they are)

Djact ships its own HTML template and expects your JS bundle in a specific place:

- Template: `djact/templates/djact.html`
- Client runtime: `djact/static/app.js`

The template already includes:

```html
<div id="app" data-page="{{ page|safe }}"></div>
<script type="module" src="{% static 'app.js' %}"></script>
```

So you do NOT need to create your own template unless you want to customize it.

---

## 7) React bundle (must be created once)

You must build a React bundle and place it at:

```
djact/static/app.js
```

Below is the full step-by-step setup using Vite.

---

## 8) React setup with Vite (full steps)

### 8.1 Initialize npm

```bash
npm init -y
```

### 8.2 Install React

```bash
npm install react react-dom
```

### 8.3 Install Vite

```bash
npm install -D vite @vitejs/plugin-react
```

### 8.4 Create `vite.config.js`

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

### 8.5 Create your entry file `src/main.js`

```javascript
import { bootstrap } from "../djact/djact/index.js";
bootstrap();
```

This file is the entry point that boots Djact on the browser side.

### 8.6 Build

```bash
npx vite build
```

After build, the output file must exist at:

```
djact/static/app.js
```

---

## 9) Example React files you already get

Inside the package you already have example files:

- `djact/djact/App.jsx`
- `djact/djact/index.js`

`App.jsx` is a minimal React component.
`index.js` is a minimal resolver + bootstrap.

You can replace these later with your own pages, but the default works for testing.

---

## 10) How render + data flow works

1. Django view calls `djact_render()`.
2. Server builds a payload:
   - `component` (string name)
   - `props` (dict)
   - `url` (current path)
3. First request returns HTML (`djact/templates/djact.html`).
4. HTML embeds JSON in `data-page`.
5. Browser loads `djact/static/app.js`.
6. React mounts and renders the component.
7. Next navigation sends `X-Djact: true`.
8. Server returns JSON and React swaps the component.

---

## 11) Passing props from Django to React

```python
return djact_render(request, "Home", {"user": "Ankur", "count": 12})
```

In React you read it normally:

```jsx
export default function Home(props) {
  return <div>{props.user}</div>;
}
```

---

## 12) Shared props on every page

```python
request.djact.share("authUser", {"name": "Ankur"})
```

This data is automatically merged into every `djact_render()` response.

---

## 13) Login / redirect issue (fix)

If login redirects do not work during Djact navigation:

1) Ensure `DjactMiddleware` is enabled.
2) Use normal Django `redirect()` in your login view.
3) Use `Link` or `djactVisit()` on the frontend so `X-Djact` is sent.

Djact middleware adds `X-Djact-Location` to redirects, and the client performs a hard redirect when needed.

---

## 14) Run Django

```bash
python manage.py runserver
```

Open:

```
http://127.0.0.1:8000/
```

---

## 15) Final checklist

- [ ] `djact` installed
- [ ] `DjactMiddleware` enabled
- [ ] `djact_render()` used in views
- [ ] `djact/static/app.js` built
- [ ] Template loads and React mounts

---

## Package layout (reference)

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

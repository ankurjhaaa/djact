# djact ⚛️🐍

**djact** is a lightweight, production-ready bridge between **Django** and **React**. It allows you to build single-page applications (SPAs) using a server-driven architecture—similar to Inertia.js—without the complexity of building a REST or GraphQL API.

With **djact**, Django remains your source of truth for routing, authentication, and data logic, while React is used purely for the view layer.

---

## 🌟 Features

- **Server-Driven Routing**: Use standard Django URLs and views. No React Router needed.
- **No REST API Required**: Pass data directly from your views to React components as props.
- **Multi-App Support**: Scale easily by organizing components across multiple Django apps.
- **SPA Experience**: Smooth client-side navigation using the custom `<Link>` component.
- **Zero Configuration**: Lightweight engine that works out of the box with any bundling tool (Vite, Webpack, etc.).
- **Built-in Security**: Automatic CSRF handling and safe JSON serialisation.

---

## 🚀 Installation

Install the package via pip:

```bash
pip install djact
```

---

## ⚙️ Django Setup

### 1. Register the App
Add `djact` to your `INSTALLED_APPS` in `settings.py`:

```python
INSTALLED_APPS = [
    # ...
    "djact",
    # ...
]
```

### 2. Add Middleware
Include the `DjactMiddleware` to enable request detection and shared data support:

```python
MIDDLEWARE = [
    # ...
    "djact.middleware.DjactMiddleware",
    # ...
]
```

### 3. Static Files
Ensure your `STATIC_URL` is configured. Djact serves its client-side engine from your static files.

---

## 📖 Basic Usage

In your Django view, use `djact_render` instead of the standard `render`. You provide the component name (including the app namespace) and a dictionary of props.

```python
# apps/library/views.py
from djact import djact_render

def home(request):
    return djact_render(request, "library/Home", {
        "name": "Ankur",
        "books_count": 42
    })
```

---

## ⚛️ React Setup

In your frontend entry point (e.g., `main.jsx`), bootstrap the application using `createDjactApp`. The `resolve` function tells the engine how to find your component files based on the name sent by Django.

```javascript
import { createDjactApp } from "djact/static/djact/app.js";

createDjactApp({
  resolve: async (name) => {
    // Split "library/Home" into app and page name
    const [app, page] = name.split('/');
    
    // Dynamically import the component from your project structure
    return import(`./apps/${app}/frontend/Pages/${page}.jsx`);
  }
});
```

---

## 🗺️ Recommended Project Structure

To keep your project clean, we recommend placing your React components inside a `frontend/Pages/` directory within each Django app.

```text
my_project/
├── apps/
│   ├── library/
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── frontend/
│   │       └── Pages/
│   │           └── Home.jsx     <-- "library/Home"
│   └── student/
│       └── frontend/
│           └── Pages/
│               └── Profile.jsx  <-- "student/Profile"
├── static/
├── manage.py
└── main.jsx                     <-- Your JS entry point
```

---

## 🔗 Navigation

To maintain the SPA experience, use the provided `<Link>` component for internal navigation. This prevents full page reloads and fetches only the component data.

```jsx
import { Link } from "djact/static/djact/app.js";

export default function Navbar() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/dashboard">Dashboard</Link>
    </nav>
  );
}
```

---

## 🛠️ How it Works

1. **The Request**: A user clicks a `<Link>`.
2. **The Server**: Django receives the request with a special `X-Djact` header.
3. **The View**: `djact_render` detects the header and returns a JSON payload containing the component name and props.
4. **The Bridge**: The Djact JS engine receives the JSON, resolves the React component, and updates the view state.
5. **The Render**: React re-renders only the changed portion of the page.

*Note: For the very first visit, Django returns a full HTML shell to ensure SEO and fast initial load.*

---

## ✅ Best Practices

- **Source of Truth**: Always keep your business logic and routing in Django. React should only be used for rendering and UI state.
- **Avoid React Router**: Using a frontend router defeats the purpose of **djact**. Let Django handle the URLs.
- **Naming Conventions**: Always use the `app_name/ComponentName` format to avoid conflicts as your project grows.
- **Shared Data**: Use `request.djact.share()` in middleware for data needed globally (like the current user).

---

## 🔮 Future Scope

- **SSR Support**: Built-in server-side rendering for even better SEO.
- **TypeScript**: First-class types for both Python and JavaScript.
- **Dev Tools**: A browser extension to inspect Djact props and history state.

---

## 📄 License

MIT © [Ankur Jha](https://github.com/ankurjha)

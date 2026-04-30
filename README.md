# djact ⚛️🐍

**djact** is a production-ready bridge between **Django** and **React**. It allows you to build single-page applications (SPAs) using a server-driven architecture—similar to Inertia.js—but designed specifically for the Django ecosystem.

With **djact**, Django handles your routing, authentication, and database logic. React is used strictly for rendering your user interface. No REST API or GraphQL layer is required.

---

## 🛠️ How it Works

The flow is simple and predictable:

1. **User Action**: A user clicks a `<Link>` or enters a URL.
2. **Django Route**: Django's `urls.py` captures the request and calls a standard view.
3. **View Logic**: You perform your database queries and logic in the view.
4. **Djact Render**: You call `djact_render(request, "ComponentName", props)`.
5. **Smart Response**:
   - On the **first visit**, Djact returns a full HTML page.
   - On **subsequent clicks**, Djact returns a tiny JSON payload.
6. **React Render**: The frontend engine receives the props and swaps the component instantly without a page reload.

---

## 🚀 Installation

Install via pip:

```bash
pip install djact
```

---

## ⚙️ Django Setup (Step-by-Step)

### 1. Add to `INSTALLED_APPS`
Open your `settings.py` and add `djact`:

```python
INSTALLED_APPS = [
    ...
    "djact",
    ...
]
```

### 2. Add Middleware
Add the `DjactMiddleware` to your middleware list:

```python
MIDDLEWARE = [
    ...
    "djact.middleware.DjactMiddleware",
    ...
]
```

### 3. Static Files & Templates
Ensure your template engine is configured with `APP_DIRS: True` (this is the Django default). When you are ready for production, run:

```bash
python manage.py collectstatic
```

---

## 📖 Basic Usage

In your views, import and use `djact_render`. You can pass any string as the component name and any dictionary as props.

```python
from djact import djact_render

def home_view(request):
    return djact_render(request, "Home", {
        "user_name": request.user.username,
        "items": ["Laptop", "Mouse", "Keyboard"]
    })
```

---

## ⚛️ React Setup

### 1. Initialize your project
You can use Vite or any bundler you prefer. Create a directory for your React components (e.g., `frontend/Pages/`).

### 2. Bootstrap the engine
In your main JavaScript entry point (e.g., `app.js`), initialize Djact. You have full control over how component names map to files.

```javascript
import { createDjactApp } from "djact/static/djact/app.js";

createDjactApp({
  resolve: (name) => import(`./Pages/${name}.jsx`),
});
```

---

## 📂 Project Structure Options

Djact is **generic**. It does not enforce a folder structure. Here are two common ways to organize your project:

### Option 1: Centralized (Simple)
Best for small to medium projects where all React code lives in one place.

```text
my_project/
├── frontend/
│   └── Pages/
│       ├── Home.jsx
│       └── Dashboard.jsx
├── app.js (JS entry point)
└── manage.py
```

### Option 2: Modular (Multiple Django Apps)
Best for large projects with independent apps like `library` and `salon`.

```text
my_project/
├── apps/
│   ├── library/
│   │   ├── views.py (returns "Library/Home")
│   │   └── frontend/Pages/Home.jsx
│   └── salon/
│       ├── views.py (returns "Salon/Booking")
│       └── frontend/Pages/Booking.jsx
├── app.js (JS entry point)
└── manage.py
```

In this case, your resolver in `app.js` might look like this:
```javascript
resolve: (name) => {
  const [app, page] = name.split('/');
  return import(`./apps/${app.toLowerCase()}/frontend/Pages/${page}.jsx`);
}
```

---

## 🔗 Navigation

Always use the `<Link>` component for internal navigation to keep the SPA experience.

```jsx
import { Link } from "djact/static/djact/app.js";

export function Navbar() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/profile">Profile</Link>
    </nav>
  );
}
```

---

## ✅ Best Practices

- **Django is the Boss**: Let Django handle all routing, redirects, and permissions.
- **No React Router**: Do not install `react-router`. It will conflict with Django's routing.
- **Pure Components**: Keep your React components focused on rendering. Don't fetch data from within React; get it from props.

---

## ⚠️ Common Mistakes

1. **Installing React Router**: This is the most common mistake. Djact handles navigation for you.
2. **Hardcoding Paths**: Always use dynamic imports in your `resolve` function so your bundle stays small.
3. **Putting JSX in Django Templates**: All your UI logic should live in `.jsx` or `.tsx` files, not in `.html` files.

---

## 📄 License

MIT

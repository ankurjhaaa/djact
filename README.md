# djact ⚛️🐍

Welcome to **djact**! This is a complete, step-by-step guide to building your first project using Django and React without the headache of APIs.

---

## 1. What is Djact?

Think of **djact** as a bridge.

- **Django** handles the "Brain": It manages your database, users, and page logic.
- **React** handles the "Beauty": It renders the user interface (UI) and makes it feel fast.
- **No REST API Needed**: You don't need to build complex endpoints. You just pass data from Django to React like you would with a normal template.
- **SPA Feel**: Your app feels like a Single Page Application (fast and fluid) because Djact only swaps the content of the page when you click a link.

## 2. Installation

```bash
pip install djact
```

## 3. Create your Django Project

Let's start a fresh project from scratch.

```bash
# Create the project folder
django-admin startproject myproject

# Go inside the project
cd myproject

# Create an app called "core"
python manage.py startapp core
```

**What just happened?**
You now have a folder named `myproject` containing your project settings and an app named `core` where we will write our code.

---

## 4. Django Setup

Open `myproject/settings.py` and make these changes:

### Add to `INSTALLED_APPS`
Tell Django to use `djact` and your new `core` app.

```python
INSTALLED_APPS = [
    ...
    "djact",
    "core",
]
```

### Add Middleware
Middleware is code that runs on every request. This allows Djact to detect when a user is navigating.

```python
MIDDLEWARE = [
    ...
    "djact.middleware.DjactMiddleware",
]
```

---

## 5. Create a View

In Django, a "View" is the function that handles a specific URL.

Open `core/views.py` and paste this:

```python
from djact import djact_render

def home(request):
    return djact_render(request, "Home", {
        "name": "Ankur"
    })
```

**Explanation:**
We are telling Django to render a React component named **"Home"** and pass it a prop named `name` with the value `"Ankur"`.

---

## 6. Create URLs

We need to tell Django which URL should trigger our view.

### Step 1: Create `core/urls.py`
Create a new file at `core/urls.py` and add:

```python
from django.urls import path
from .views import home

urlpatterns = [
    path("", home, name="home"),
]
```

### Step 2: Update `myproject/urls.py`
Update your project's main URL file to include the one we just made:

```python
from django.urls import path, include

urlpatterns = [
    path("", include("core.urls")),
]
```

---

## 7. Template Setup

Djact needs one basic HTML file to "mount" React.

1. Create a folder named `templates` in your project root.
2. Inside `templates`, create a file named `djact.html`.

### File: `templates/djact.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token }}">
    <title>My Djact App</title>
</head>
<body>
    <!-- React will mount inside this div -->
    <div id="app" data-page='{{ page|safe }}'></div>

    <!-- This is your bundled React JavaScript -->
    <script type="module" src="/static/dist/main.js"></script>
</body>
</html>
```

**Why is this needed?**
This is the "shell". Django loads this file once, and then React takes over the `div#app`. The `data-page` attribute is how Django "sends" the initial props to React.

---

## 8. React Setup

Now let's set up the frontend using Vite.

```bash
# In your project root, run:
npm create vite@latest frontend -- --template react

# Go into the frontend folder
cd frontend

# Install dependencies
npm install
```

---

## 9. The Bridge: `main.jsx`

This is the most important file in the frontend. It connects Django to React.

Open `frontend/src/main.jsx` and replace everything with:

```jsx
import { createDjactApp } from "djact/static/djact/app.js";

createDjactApp({
  resolve: (name) => import(`./Pages/${name}.jsx`),
});
```

**What is happening here?**
- `createDjactApp`: This is the Djact engine. It reads the `data-page` from the HTML we created in Step 7.
- `resolve`: This function tells Djact where to find your React files. When Django says "Render Home", Djact looks for `./Pages/Home.jsx`.

---

## 10. Create React Pages

Create a folder named `Pages` inside `frontend/src/`. Then create your first page.

### File: `frontend/src/Pages/Home.jsx`

```jsx
export default function Home({ name }) {
    return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>Hello {name}!</h1>
            <p>Welcome to your Djact application.</p>
        </div>
    );
}
```

**Note:** The `name` prop comes directly from the Django view we wrote in Step 5!

---

## 11. Build React

Before Django can see your React code, you must build it.

In your `frontend` folder, open `vite.config.js` and set the build output to your Django static folder:

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static/dist', // Build directly into Django's static folder
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
  },
})
```

Now run the build:
```bash
npm run build
```

---

## 12. Run the Project

Go back to your project root (where `manage.py` is) and start the server:

```bash
python manage.py runserver
```

Open your browser and visit: **http://127.0.0.1:8000/**

You should see **"Hello Ankur!"**

---

## 13. Navigation (Moving between pages)

To move between pages without a full reload, use the `<Link>` component.

```jsx
import { Link } from "djact/static/djact/app.js";

export default function Home({ name }) {
    return (
        <div>
            <h1>Hello {name}</h1>
            <Link href="/about">Go to About Page</Link>
        </div>
    );
}
```

**How it works:**
When you click the Link, Djact tells Django "Hey, I need the About page data". Django sends back the props, and React swaps the component instantly.

---

## 14. Full Project Structure

This is what your project should look like:

```text
myproject/
├── core/
│   ├── urls.py
│   └── views.py
├── myproject/
│   ├── settings.py
│   └── urls.py
├── templates/
│   └── djact.html
├── static/
│   └── dist/ (Generated by npm run build)
├── frontend/
│   ├── src/
│   │   ├── Pages/
│   │   │   └── Home.jsx
│   │   └── main.jsx
│   └── vite.config.js
└── manage.py
```

---

## 15. Common Questions

**Q: Where should I write my React code?**
A: Inside `frontend/src/Pages/`. Each file should match the name you use in `djact_render`.

**Q: Do I need React Router?**
A: **No.** Django handles all the routes in `urls.py`.

**Q: Why do I need to run `npm run build`?**
A: Browsers cannot read `.jsx` files directly. The build step converts them into a single `.js` file that the browser understands.

**Q: Can I use multiple Django apps?**
A: Yes! You can organize your pages however you like. Just make sure your `resolve` function in `main.jsx` can find them.

---

## 16. Common Mistakes to Avoid

1. **Forgetting to Build**: If you change your React code, you must run `npm run build` (or run Vite in watch mode) for Django to see the changes.
2. **Missing Middleware**: If you get a "Page not found" error or the link reloads the whole page, check if `DjactMiddleware` is in `settings.py`.
3. **Wrong Static Path**: Make sure the `<script>` tag in `djact.html` matches where Vite is building your files.

---

## 📄 License

MIT

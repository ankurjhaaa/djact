import { createDjactApp } from "../../static/app.js";

export function resolve(name) {
  // Minimal example resolver: use the same component for every page.
  // Replace this with dynamic imports when you add real pages.
  return import("./App.jsx");
}

export function bootstrap() {
  return createDjactApp({
    resolve,
    onError: (error) => {
      console.error("Djact bootstrap error:", error);
    },
  });
}

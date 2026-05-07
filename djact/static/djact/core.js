/**
 * djact/core.js — Initialization and Component Management.
 *
 * Scans for [dj:component="name"], reads initial state from [dj:state],
 * calls mount() on the server, and manages the render cycle for each
 * component independently.
 */
import { render } from "./renderer.js";
import { bindDirectives } from "./directives.js";
import { callServer } from "./api.js";
import { parseStateString } from "./state.js";

const _components = new Map();

export function bootstrap() {
  const roots = document.querySelectorAll("[dj\\:component]");
  
  roots.forEach(root => {
    const componentName = root.getAttribute("dj:component");
    if (!componentName) return;

    // Skip if already bound
    if (root.dataset.djBound === "1") return;
    root.dataset.djBound = "1";

    // Parse initial state from dj:state attribute
    const stateAttr = root.getAttribute("dj:state") || "";
    let state = parseStateString(stateAttr);

    function getState() {
      return state;
    }

    function setState(updates) {
      if (typeof updates === "function") {
        state = { ...state, ...updates(state) };
      } else {
        state = { ...state, ...updates };
      }
      
      // Update global dev helper
      window.djact = window.djact || {};
      window.djact.components = window.djact.components || {};
      window.djact.components[componentName] = state;

      render(root, state);
    }

    _components.set(root, { name: componentName, getState, setState });

    // Initial render with parsed state (before mount)
    render(root, state);

    // Bind event listeners for this component
    bindDirectives(root, componentName, getState, setState);

    // Call mount() on server to get full initial state
    callServer(componentName, "mount", state)
      .then((data) => {
        if (data) setState(data);
      })
      .catch((err) => {
        console.error(`[djact] Failed to mount component '${componentName}':`, err);
      });
  });
}

// Expose dev helpers
window.djact = window.djact || {};
window.djact.bootstrap = bootstrap;

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
let _mountPromises = [];

export function bootstrap() {
  _mountPromises = [];
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
      
      window.djact = window.djact || {};
      window.djact.components = window.djact.components || {};
      window.djact.components[componentName] = state;

      render(root, state);
    }

    _components.set(root, { name: componentName, getState, setState });

    // Bind event listeners for this component
    bindDirectives(root, componentName, getState, setState);

    // Call mount() on server to get full initial state
    const mountPromise = callServer(componentName, "mount", state)
      .then((data) => {
        if (data) setState(data);
      })
      .catch((err) => {
        console.error(`[djact] Failed to mount component '${componentName}':`, err);
      });
      
    _mountPromises.push(mountPromise);
  });

  // Remove anti-blink CSS after ALL components have mounted
  Promise.allSettled(_mountPromises).then(() => {
    const antiBlink = document.getElementById("djact-anti-blink");
    if (antiBlink) antiBlink.remove();
  });
}

// Expose dev helpers
window.djact = window.djact || {};
window.djact.bootstrap = bootstrap;

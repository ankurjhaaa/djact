import { parseStateString } from "./state.js";
import { render } from "./renderer.js";
import { bindDirectives } from "./directives.js";
import { callServer } from "./api.js";

export function bootstrap() {
  const root = document.querySelector("[dj\\:state]");
  if (!root) return;

  let state = parseStateString(root.getAttribute("dj:state") || "");

  function getState() {
    return state;
  }

  function setState(updates) {
    if (typeof updates === "function") {
      state = { ...state, ...updates(state) };
    } else {
      state = { ...state, ...updates };
    }
    window.djact.state = state;
    render(root, state);
  }

  // Expose state and setState for custom methods
  window.djact = window.djact || {};
  window.djact.state = state;
  window.djact.setState = setState;

  bindDirectives(root, getState, setState);

  // Initial render
  render(root, state);

  // Call mount() if present
  callServer("mount", state)
    .then((data) => {
      if (data) setState(data);
    })
    .catch(() => {});
}

window.djact = window.djact || {};
window.djact.bootstrap = bootstrap;

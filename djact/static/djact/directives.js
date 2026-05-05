import { callServer } from "./api.js";
import { parseUpdatesString } from "./state.js";

export function bindDirectives(root, state, setState) {
  const clickNodes = root.querySelectorAll("[dj\\:click]");
  clickNodes.forEach((node) => {
    const method = node.getAttribute("dj:click");
    node.addEventListener("click", async (event) => {
      event.preventDefault();
      if (!method) return;
      const result = await callServer(method, state);
      if (result) setState(result);
    });
  });

  const submitNodes = root.querySelectorAll("[dj\\:submit]");
  submitNodes.forEach((node) => {
    const method = node.getAttribute("dj:submit");
    node.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!method) return;
      const result = await callServer(method, state);
      if (result) setState(result);
    });
  });

  const funcNodes = root.querySelectorAll("[dj\\:function]");
  funcNodes.forEach((node) => {
    const expr = node.getAttribute("dj:function");
    node.addEventListener("click", (event) => {
      event.preventDefault();
      if (!expr) return;
      if (expr.startsWith("setState(")) {
        const args = expr.slice(9, -1);
        const updates = parseUpdatesString(args);
        setState(updates);
      } else if (window.methods && typeof window.methods[expr] === "function") {
        window.methods[expr](state, setState);
      }
    });
  });
}

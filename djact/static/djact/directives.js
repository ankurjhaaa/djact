import { callServer } from "./api.js";
import { parseUpdatesString } from "./state.js";
import { evaluateExpression } from "./renderer_expr.js";

export function bindDirectives(root, getState, setState) {
  if (root.dataset.djBound === "1") return;
  root.dataset.djBound = "1";

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const funcNode = target.closest("[dj\\:function]");
    if (funcNode) {
      event.preventDefault();
      const expr = funcNode.getAttribute("dj:function");
      if (!expr) return;
      if (expr.startsWith("setState(")) {
        const start = expr.indexOf("(") + 1;
        const end = expr.lastIndexOf(")");
        const args = expr.slice(start, end);
        // Use functional updater to avoid stale-state races
        setState((prev) => {
          const updates = parseUpdatesString(args, prev || {});
          return { ...prev, ...updates };
        });
      } else {
        const call = parseFunctionCall(expr);
        if (!call) return;
        const { name, args } = call;
        if (window.methods && typeof window.methods[name] === "function") {
          const evaluated = args.map((arg) => evaluateExpression(arg, getState()));
          // pass the element as the last argument so methods can access DOM/data
          window.methods[name](...evaluated, getState(), setState, funcNode);
        }
      }
      return;
    }

    const clickNode = target.closest("[dj\\:click]");
    if (clickNode) {
      event.preventDefault();
      const method = clickNode.getAttribute("dj:click");
      if (!method) return;
      // If the click is inside a dj:for clone, include its index in payload
      const clone = clickNode.closest('[data-dj-for-clone]');
      const idx = clone && clone.dataset && typeof clone.dataset.djIndex !== 'undefined' ? Number(clone.dataset.djIndex) : undefined;
      const payload = { ...getState() };
      if (typeof idx === 'number' && !Number.isNaN(idx)) payload.index = idx;
      callServer(method, payload).then((result) => {
        if (result) setState(result);
      });
      return;
    }

    const pageButton = target.closest("[data-dj-page]");
    if (pageButton) {
      const container = pageButton.closest("[dj\\:paginate]");
      if (!container) return;
      event.preventDefault();
      const page = Number(pageButton.getAttribute("data-dj-page"));
      const key = container.dataset.djPaginateKey || container.getAttribute("dj:paginate") || "";
      const isServerPagination = container.dataset.djPaginateIsServer === "true";
      
      if (isServerPagination) {
        const method = container.dataset.djPaginateMethod || "paginate";
        const payload = { ...getState(), __page: page, __paginate: key };
        callServer(method, payload).then((result) => {
          if (result) setState(result);
        });
      } else {
        // Client-side pagination: just update state
        const pages = { ...(getState().__djact_page || {}) };
        pages[key] = page;
        setState({ __djact_page: pages });
      }
      return;
    }
  });

  root.addEventListener("submit", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const submitNode = target.closest("[dj\\:submit]");
    if (!submitNode) return;
    event.preventDefault();
    const method = submitNode.getAttribute("dj:submit");
    if (!method) return;
    // include index if inside a dj:for clone
    const clone = submitNode.closest('[data-dj-for-clone]');
    const idx = clone && clone.dataset && typeof clone.dataset.djIndex !== 'undefined' ? Number(clone.dataset.djIndex) : undefined;
    const payload = { ...getState(), ...collectFormValues(submitNode) };
    if (typeof idx === 'number' && !Number.isNaN(idx)) payload.index = idx;
    callServer(method, payload).then((result) => {
      if (result) setState(result);
    });
  });

  // Delegated events are attached once per root.
}

function parseFunctionCall(expr) {
  const match = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!match) {
    return { name: expr, args: [] };
  }

  const name = match[1];
  const argString = match[2].trim();
  if (!argString) return { name, args: [] };
  return { name, args: splitArgs(argString) };
}

function splitArgs(argString) {
  const args = [];
  let current = "";
  let inQuote = null;

  for (let i = 0; i < argString.length; i++) {
    const ch = argString[i];
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
      current += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === ",") {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function collectFormValues(node) {
  const form = node instanceof HTMLFormElement ? node : node.closest("form");
  if (!form) return {};
  const data = new FormData(form);
  const out = {};
  for (const [key, value] of data.entries()) {
    out[key] = value;
  }
  return out;
}

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
        const args = expr.slice(9, -1);
        const updates = parseUpdatesString(args, getState());
        setState(updates);
      } else {
        const call = parseFunctionCall(expr);
        if (!call) return;
        const { name, args } = call;
        if (window.methods && typeof window.methods[name] === "function") {
          const evaluated = args.map((arg) => evaluateExpression(arg, getState()));
          window.methods[name](...evaluated, getState(), setState);
        }
      }
      return;
    }

    const clickNode = target.closest("[dj\\:click]");
    if (clickNode) {
      event.preventDefault();
      const method = clickNode.getAttribute("dj:click");
      if (!method) return;
      callServer(method, getState()).then((result) => {
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
      const method = container.dataset.djPaginateMethod || "paginate";
      const key = container.dataset.djPaginateKey || container.getAttribute("dj:paginate") || "";
      const payload = { ...getState(), __page: page, __paginate: key };
      callServer(method, payload).then((result) => {
        if (result) setState(result);
      });
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
    callServer(method, getState()).then((result) => {
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

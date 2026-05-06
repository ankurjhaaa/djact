/**
 * djact/directives.js — Event binding and directives logic.
 *
 * Handles:
 * - dj:click, dj:submit, dj:function
 * - dj:model (two-way binding)
 * - dj:extra (attaches extra data to requests)
 * - Pagination clicks
 */
import { callServer } from "./api.js";
import { parseUpdatesString } from "./state.js";
import { evaluateExpression } from "./renderer_expr.js";
import { resolveScope } from "./renderer.js";

export function bindDirectives(root, componentName, getState, setState) {
  // -------------------------------------------------------------------------
  // dj:model (Two-way binding)
  // -------------------------------------------------------------------------
  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    
    const modelAttr = target.getAttribute("dj:model");
    if (!modelAttr) return;

    let value = target.value;
    if (target.type === "checkbox") {
      value = target.checked;
    }

    setState({ [modelAttr]: value });
  });

  // -------------------------------------------------------------------------
  // dj:click & dj:function
  // -------------------------------------------------------------------------
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // -- dj:function (Client-side) --
    const funcNode = target.closest("[dj\\:function]");
    if (funcNode) {
      event.preventDefault();
      const expr = funcNode.getAttribute("dj:function");
      if (!expr) return;

      if (expr.startsWith("setState(")) {
        const start = expr.indexOf("(") + 1;
        const end = expr.lastIndexOf(")");
        const args = expr.slice(start, end);
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
          window.methods[name](...evaluated, getState(), setState, funcNode);
        } else {
          console.warn(`[djact] window.methods.${name} is not defined.`);
        }
      }
      return;
    }

    // -- dj:click (Server-side) --
    const clickNode = target.closest("[dj\\:click]");
    if (clickNode) {
      event.preventDefault();
      const methodStr = clickNode.getAttribute("dj:click");
      if (!methodStr) return;

      const call = parseFunctionCall(methodStr);
      const method = call.name;
      let argsList = [];
      if (call.args.length > 0) {
         const scope = resolveScope(clickNode, getState());
         argsList = call.args.map(arg => evaluateExpression(arg, scope));
      }

      const payload = { ...getState(), ...collectExtras(clickNode) };
      if (argsList.length > 0) payload.__args = argsList;
      
      // Index for loops
      const clone = clickNode.closest('[data-dj-for-clone]');
      if (clone && clone.dataset.djIndex !== undefined) {
        payload.index = Number(clone.dataset.djIndex);
      }

      callServer(componentName, method, payload).then((result) => {
        if (result) setState(result);
      }).catch(console.error);
      return;
    }

    // -- Pagination --
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
        callServer(componentName, method, payload).then((result) => {
          if (result) setState(result);
        }).catch(console.error);
      } else {
        // Client-side pagination
        const pages = { ...(getState().__djact_page || {}) };
        pages[key] = page;
        setState({ __djact_page: pages });
      }
      return;
    }
  });

  // -------------------------------------------------------------------------
  // dj:submit
  // -------------------------------------------------------------------------
  root.addEventListener("submit", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    
    const submitNode = target.closest("[dj\\:submit]");
    if (!submitNode) return;
    
    event.preventDefault();
    const methodStr = submitNode.getAttribute("dj:submit");
    if (!methodStr) return;
    
    const call = parseFunctionCall(methodStr);
    const method = call.name;
    let argsList = [];
    if (call.args.length > 0) {
       const scope = resolveScope(submitNode, getState());
       argsList = call.args.map(arg => evaluateExpression(arg, scope));
    }

    const payload = { 
      ...getState(), 
      ...collectFormValues(submitNode),
      ...collectExtras(submitNode)
    };
    if (argsList.length > 0) payload.__args = argsList;

    const clone = submitNode.closest('[data-dj-for-clone]');
    if (clone && clone.dataset.djIndex !== undefined) {
      payload.index = Number(clone.dataset.djIndex);
    }

    callServer(componentName, method, payload).then((result) => {
      if (result) setState(result);
    }).catch(console.error);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectExtras(node) {
  const extraStr = node.getAttribute("dj:extra");
  if (!extraStr) return {};
  
  // Format: dj:extra="id=task.id, type='admin'"
  // We can re-use parseUpdatesString since it parses "key=expr" against current state
  // Wait, we don't have state easily here, but we can just let state be {}
  // ACTUALLY, for dj:extra we need current scope!
  // To evaluate properly, we should resolve scope. For simplicity, we assume
  // `bindDirectives` is attached at root, but `extra` might reference loop variables.
  // We need the element's actual scope. We can cheat by reading from renderer's cache if needed,
  // or just doing basic literal parsing if it's not a loop.
  // We'll implement a basic parse for now. It will evaluate against global component state.
  
  const state = window.djact.components[node.closest("[dj\\:component]").getAttribute("dj:component")] || {};
  
  // Wait, to support loop variables in dj:extra, they really should just use [[ ]] in standard html attrs,
  // but dj:extra="id=task.id" is cleaner. For now we parse it against global state. 
  // If it's in a loop, they might need data-id="[[ task.id ]]" instead.
  // Let's implement full parsing.
  
  // Actually, renderer interpolates [[]] inside dj:extra automatically!
  // So if user writes: dj:extra="id=[[ task.id ]]", renderer makes it "id=5".
  // Then we parse it simply here.
  
  const extras = {};
  const parts = extraStr.split(",").map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    let val = part.slice(eq + 1).trim();
    
    // Convert literals
    if (!Number.isNaN(Number(val))) val = Number(val);
    else if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    else if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    
    extras[key] = val;
  }
  
  return { __extra: extras };
}

function parseFunctionCall(expr) {
  const match = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
  if (!match) return { name: expr, args: [] };

  const name = match[1];
  const argString = match[2].trim();
  if (!argString) return { name, args: [] };
  
  return { name, args: argString.split(",").map(a => a.trim()) };
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

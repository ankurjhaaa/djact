/**
 * djact/renderer.js — DOM Update Engine.
 *
 * Handles:
 * - [[ expression ]] interpolation in text nodes and attributes.
 * - dj:for loop unrolling.
 * - dj:if conditional display.
 * - dj:empty visibility toggle.
 * - dj:paginate rendering.
 */
import { evaluateExpression } from "./renderer_expr.js";

const _templateCache = new WeakMap();
const _attrCache = new WeakMap();
const _displayCache = new WeakMap();
const _scopeCache = new WeakMap();
let _forId = 0;

export function render(root, state) {
  applyLoops(root, state);
  
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  // 1. Text node interpolation
  for (const node of nodes) {
    const original = _templateCache.get(node) ?? node.nodeValue;
    if (!_templateCache.has(node)) {
      _templateCache.set(node, original || "");
    }

    if (!original || !original.includes("[[")) continue;

    const scope = resolveScope(node, state);
    const updated = original.replace(/\[\[([^\]]+)\]\]/g, (_, expr) => {
      try {
        const val = evaluateExpression(expr.trim(), scope);
        // Don't render "null" or "undefined" as string
        return (val == null) ? "" : String(val);
      } catch {
        return "";
      }
    });

    if (node.nodeValue !== updated) {
      node.nodeValue = updated;
    }
  }

  // 2. Element directives & attributes
  const elements = root.querySelectorAll("*");
  elements.forEach((el) => {
    
    // Sync dj:model with state
    if (el.hasAttribute("dj:model")) {
      const key = el.getAttribute("dj:model");
      if (state[key] !== undefined) {
        if (el.type === "checkbox") {
          el.checked = !!state[key];
        } else if (el.value !== state[key]) {
          el.value = state[key];
        }
      }
    }

    // Interpolate standard attributes and dj:extra
    const cache = _attrCache.get(el) || new Map();
    for (const attr of Array.from(el.attributes)) {
      // Don't interpolate inside framework directives, except dj:extra
      if (attr.name.startsWith("dj:") && attr.name !== "dj:extra") continue;
      
      const original = cache.get(attr.name) ?? attr.value;
      if (!cache.has(attr.name)) {
        cache.set(attr.name, original);
      }
      
      if (!original.includes("[[")) continue;
      
      const scope = resolveScope(el, state);
      const updated = original.replace(/\[\[([^\]]+)\]\]/g, (_, expr) => {
        try {
          const val = evaluateExpression(expr.trim(), scope);
          return (val == null) ? "" : String(val);
        } catch {
          return "";
        }
      });
      
      if (el.getAttribute(attr.name) !== updated) {
        el.setAttribute(attr.name, updated);
      }
    }
    _attrCache.set(el, cache);

    // dj:if
    if (el.hasAttribute("dj:if")) {
      const expr = el.getAttribute("dj:if") || "";
      const scope = resolveScope(el, state);
      const show = !!evaluateExpression(expr, scope);
      
      if (!_displayCache.has(el)) {
        _displayCache.set(el, el.style.display || "");
      }
      
      const expected = show ? _displayCache.get(el) : "none";
      if (el.style.display !== expected) {
        el.style.display = expected;
      }
    }

    // dj:empty
    if (el.hasAttribute("dj:empty")) {
      const listName = el.getAttribute("dj:empty") || "";
      const list = resolveList(state, listName);
      const show = list.length === 0;
      
      if (!_displayCache.has(el)) {
        _displayCache.set(el, el.style.display || "");
      }
      
      const expected = show ? _displayCache.get(el) : "none";
      if (el.style.display !== expected) {
        el.style.display = expected;
      }
    }

    // dj:paginate
    if (el.hasAttribute("dj:paginate")) {
      renderPagination(el, state);
    }
  });
}

function applyLoops(root, state) {
  const loopNodes = root.querySelectorAll("[dj\\:for]");
  loopNodes.forEach((node) => {
    const expr = node.getAttribute("dj:for") || "";
    const match = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+in\s+([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (!match) return;

    const itemName = match[1];
    const listName = match[2];
    const list = resolveList(state, listName, node.parentElement?.querySelector(`[dj\\:paginate="${listName}"]`));
    
    const id = node.dataset.djForId || `djfor-${++_forId}`;
    node.dataset.djForId = id;

    const parent = node.parentElement;
    if (!parent) return;

    // Remove old clones
    parent.querySelectorAll(`[data-dj-for-clone="${id}"]`).forEach((el) => el.remove());

    // Hide the template node
    node.style.display = "none";

    // Insert new clones
    let insertAfter = node;
    list.forEach((item, index) => {
      const clone = node.cloneNode(true);
      clone.removeAttribute("dj:for");
      clone.style.display = "";
      clone.dataset.djForClone = id;
      clone.dataset.djIndex = String(index);
      
      const scope = { ...state, [itemName]: item, $index: index };
      _scopeCache.set(clone, scope);
      
      insertAfter.after(clone);
      insertAfter = clone;
    });
  });
}

function resolveScope(node, state) {
  let current = node.nodeType === 1 ? node : node.parentElement;
  while (current) {
    if (_scopeCache.has(current)) {
      return _scopeCache.get(current);
    }
    current = current.parentElement;
  }
  return state;
}

function resolvePerPage(container, state, key) {
  const attrPer = container.getAttribute("dj:per-page");
  if (attrPer) {
    return Number(attrPer) || 20;
  }
  const perPages = state.__djact_per_page || {};
  return (typeof perPages[key] === "number") ? perPages[key] : 20;
}

function resolveList(state, listName, container = null) {
  if (!listName) return [];
  const value = state[listName];
  if (!value) return [];
  
  // Check if server-side pagination response
  if (value.data && typeof value.current_page === "number") {
    return value.data;
  }
  
  // Client-side pagination: slice array based on page
  if (Array.isArray(value)) {
    if (!container) return value;
    
    const perPage = resolvePerPage(container, state, listName);
    const pages = state.__djact_page || {};
    const page = (typeof pages[listName] === "number") ? pages[listName] : 1;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    
    return value.slice(start, end);
  }
  
  return [];
}

function renderPagination(container, state) {
  const key = container.getAttribute("dj:paginate") || "";
  const value = state[key];
  if (!value) {
    container.innerHTML = "";
    return;
  }

  const isServerPagination = value.data && typeof value.current_page === "number";
  
  let current, last, method;
  if (isServerPagination) {
    current = value.current_page;
    last = value.last_page || 1;
    method = value.method || "paginate";
  } else if (Array.isArray(value)) {
    const perPage = resolvePerPage(container, state, key);
    const pages = state.__djact_page || {};
    current = (typeof pages[key] === "number") ? pages[key] : 1;
    last = Math.ceil(value.length / perPage);
    method = null;
  } else {
    container.innerHTML = "";
    return;
  }

  container.dataset.djPaginateMethod = method || "paginate";
  container.dataset.djPaginateKey = key;
  container.dataset.djPaginateIsServer = String(isServerPagination);

  const buttons = [];
  const prevDisabled = current <= 1;
  const nextDisabled = current >= last;

  buttons.push(renderPageButton("Prev", current - 1, prevDisabled));
  for (let i = 1; i <= last; i++) {
    buttons.push(renderPageButton(String(i), i, i === current));
  }
  buttons.push(renderPageButton("Next", current + 1, nextDisabled));

  // Quick diff to avoid losing focus if not necessary, but for pagination innerHTML is fine
  container.innerHTML = "";
  buttons.forEach((btn) => container.appendChild(btn));
}

function renderPageButton(label, page, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.djPage = String(page);
  if (disabled) {
    button.disabled = true;
  }
  return button;
}

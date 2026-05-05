import { evaluateExpression } from "./renderer_expr.js";

const _templateCache = new WeakMap();

export function render(root, state) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    const original = _templateCache.get(node) ?? node.nodeValue;
    if (!_templateCache.has(node)) {
      _templateCache.set(node, original || "");
    }

    if (!original || !original.includes("[[")) continue;

    const updated = original.replace(/\[\[([^\]]+)\]\]/g, (_, expr) => {
      try {
        return String(evaluateExpression(expr.trim(), state));
      } catch {
        return "";
      }
    });

    node.nodeValue = updated;
  }
}

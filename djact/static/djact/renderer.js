import { evaluateExpression } from "./renderer_expr.js";

export function render(root, state) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    const text = node.nodeValue;
    if (!text || !text.includes("[[")) continue;

    const updated = text.replace(/\[\[([^\]]+)\]\]/g, (_, expr) => {
      try {
        return String(evaluateExpression(expr.trim(), state));
      } catch {
        return "";
      }
    });

    node.nodeValue = updated;
  }
}

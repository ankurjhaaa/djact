export function evaluateExpression(expr, state) {
  // Very small expression evaluator: supports identifiers and ternary.
  // No direct eval. We only allow identifiers, literals, and ?:.
  const tokens = tokenize(expr);
  const ast = parseTernary(tokens);
  return evaluate(ast, state);
}

function tokenize(expr) {
  const tokens = [];
  const re = /\s+|\?\:|\?|:|\(|\)|==|!=|>=|<=|&&|\|\||[a-zA-Z_][a-zA-Z0-9_]*|\d+|"[^"]*"|'[^']*'/g;
  let match;
  while ((match = re.exec(expr)) !== null) {
    const text = match[0];
    if (/^\s+$/.test(text)) continue;
    tokens.push(text);
  }
  return tokens;
}

function parseTernary(tokens) {
  // For this minimal version, parse only ternary and identifiers/literals.
  let i = 0;

  function parsePrimary() {
    const token = tokens[i++];
    if (!token) return { type: "Literal", value: "" };
    if (token.startsWith("'") || token.startsWith('"')) {
      return { type: "Literal", value: token.slice(1, -1) };
    }
    if (!Number.isNaN(Number(token))) {
      return { type: "Literal", value: Number(token) };
    }
    return { type: "Identifier", name: token };
  }

  function parseExpression() {
    let node = parsePrimary();
    if (tokens[i] === "?") {
      i++; // ?
      const consequent = parseExpression();
      if (tokens[i] !== ":") {
        return node;
      }
      i++; // :
      const alternate = parseExpression();
      node = { type: "Ternary", test: node, consequent, alternate };
    }
    return node;
  }

  return parseExpression();
}

function evaluate(node, state) {
  if (node.type === "Literal") return node.value;
  if (node.type === "Identifier") return state[node.name];
  if (node.type === "Ternary") {
    return evaluate(node.test, state) ? evaluate(node.consequent, state) : evaluate(node.alternate, state);
  }
  return "";
}

export function evaluateExpression(expr, scope) {
  // Very small expression evaluator: supports identifiers and ternary.
  // No direct eval. We only allow identifiers, literals, and ?:.
  const tokens = tokenize(expr);
  const ast = parseTernary(tokens);
  return evaluate(ast, scope || {});
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
  let i = 0;

  function parsePrimary() {
    const token = tokens[i++];
    if (!token) return { type: "Literal", value: "" };
    if (token === "(") {
      const node = parseExpression();
      i++; // )
      return node;
    }
    if (token.startsWith("'") || token.startsWith('"')) {
      return { type: "Literal", value: token.slice(1, -1) };
    }
    if (!Number.isNaN(Number(token))) {
      return { type: "Literal", value: Number(token) };
    }
    return { type: "Identifier", name: token };
  }

  function parseUnary() {
    if (tokens[i] === "-") {
      i++;
      return { type: "Unary", op: "-", value: parseUnary() };
    }
    return parsePrimary();
  }

  function parseMul() {
    let node = parseUnary();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const op = tokens[i++];
      const right = parseUnary();
      node = { type: "Binary", op, left: node, right };
    }
    return node;
  }

  function parseAdd() {
    let node = parseMul();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++];
      const right = parseMul();
      node = { type: "Binary", op, left: node, right };
    }
    return node;
  }

  function parseCompare() {
    let node = parseAdd();
    const ops = [">", "<", ">=", "<=", "==", "!="];
    while (ops.includes(tokens[i])) {
      const op = tokens[i++];
      const right = parseAdd();
      node = { type: "Compare", op, left: node, right };
    }
    return node;
  }

  function parseExpression() {
    let node = parseCompare();
    if (tokens[i] === "?") {
      i++;
      const consequent = parseExpression();
      if (tokens[i] !== ":") {
        return node;
      }
      i++;
      const alternate = parseExpression();
      node = { type: "Ternary", test: node, consequent, alternate };
    }
    return node;
  }

  return parseExpression();
}

function evaluate(node, scope) {
  if (node.type === "Literal") return node.value;
  if (node.type === "Identifier") return resolvePath(scope, node.name);
  if (node.type === "Unary") return -evaluate(node.value, scope);
  if (node.type === "Binary") {
    const left = evaluate(node.left, scope);
    const right = evaluate(node.right, scope);
    if (node.op === "+") return left + right;
    if (node.op === "-") return left - right;
    if (node.op === "*") return left * right;
    if (node.op === "/") return left / right;
  }
  if (node.type === "Compare") {
    const left = evaluate(node.left, scope);
    const right = evaluate(node.right, scope);
    if (node.op === ">") return left > right;
    if (node.op === "<") return left < right;
    if (node.op === ">=") return left >= right;
    if (node.op === "<=") return left <= right;
    if (node.op === "==") return left == right;
    if (node.op === "!=") return left != right;
  }
  if (node.type === "Ternary") {
    return evaluate(node.test, scope) ? evaluate(node.consequent, scope) : evaluate(node.alternate, scope);
  }
  return "";
}

function resolvePath(scope, path) {
  if (!path.includes(".")) {
    return scope[path];
  }

  const parts = path.split(".");
  let current = scope;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

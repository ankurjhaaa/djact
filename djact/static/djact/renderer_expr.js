/**
 * djact/renderer_expr.js — Safe expression evaluator.
 *
 * Supports: identifiers, dot-paths, literals, ternary (?:),
 * comparison (==, !=, >, <, >=, <=), logical (&&, ||),
 * arithmetic (+, -, *, /), unary (-, !), and .length property.
 *
 * NO eval() is used — everything goes through a hand-written
 * tokenizer + recursive-descent parser.
 */

export function evaluateExpression(expr, scope) {
  const tokens = tokenize(expr);
  const ctx = { tokens, pos: 0 };
  const ast = parseExpression(ctx);
  return evaluate(ast, scope || {});
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const TOKEN_RE =
  /\s+|&&|\|\||\?\:|[?:()!=<>]=?|>=|<=|[+\-*\/.,]|!(?!=)|[a-zA-Z_$][a-zA-Z0-9_$]*|\d+(?:\.\d+)?|"[^"]*"|'[^']*'/g;

function tokenize(expr) {
  const tokens = [];
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(expr)) !== null) {
    const text = match[0];
    if (/^\s+$/.test(text)) continue;
    tokens.push(text);
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent)
// ---------------------------------------------------------------------------

function peek(ctx) {
  return ctx.tokens[ctx.pos];
}

function consume(ctx) {
  return ctx.tokens[ctx.pos++];
}

function parsePrimary(ctx) {
  const token = peek(ctx);
  if (!token) return { type: "Literal", value: "" };

  // Parenthesised expression
  if (token === "(") {
    consume(ctx); // (
    const node = parseExpression(ctx);
    consume(ctx); // )
    return node;
  }

  // Unary NOT
  if (token === "!") {
    consume(ctx);
    return { type: "Unary", op: "!", value: parsePrimary(ctx) };
  }

  // Unary minus
  if (token === "-") {
    consume(ctx);
    return { type: "Unary", op: "-", value: parsePrimary(ctx) };
  }

  // String literal
  if (token.startsWith("'") || token.startsWith('"')) {
    consume(ctx);
    return { type: "Literal", value: token.slice(1, -1) };
  }

  // Number literal
  if (!Number.isNaN(Number(token)) && token !== "") {
    consume(ctx);
    return { type: "Literal", value: Number(token) };
  }

  // Boolean / null literals
  if (token === "true") { consume(ctx); return { type: "Literal", value: true }; }
  if (token === "false") { consume(ctx); return { type: "Literal", value: false }; }
  if (token === "null" || token === "undefined") { consume(ctx); return { type: "Literal", value: null }; }

  // Identifier (possibly with dot-path: item.name.length)
  consume(ctx);
  let name = token;
  while (peek(ctx) === ".") {
    consume(ctx); // .
    const prop = consume(ctx);
    if (prop) name += "." + prop;
  }
  return { type: "Identifier", name };
}

function parseMul(ctx) {
  let node = parsePrimary(ctx);
  while (peek(ctx) === "*" || peek(ctx) === "/") {
    const op = consume(ctx);
    node = { type: "Binary", op, left: node, right: parsePrimary(ctx) };
  }
  return node;
}

function parseAdd(ctx) {
  let node = parseMul(ctx);
  while (peek(ctx) === "+" || peek(ctx) === "-") {
    const op = consume(ctx);
    node = { type: "Binary", op, left: node, right: parseMul(ctx) };
  }
  return node;
}

function parseCompare(ctx) {
  let node = parseAdd(ctx);
  const ops = [">", "<", ">=", "<=", "==", "!="];
  while (ops.includes(peek(ctx))) {
    const op = consume(ctx);
    node = { type: "Compare", op, left: node, right: parseAdd(ctx) };
  }
  return node;
}

function parseLogical(ctx) {
  let node = parseCompare(ctx);
  while (peek(ctx) === "&&" || peek(ctx) === "||") {
    const op = consume(ctx);
    node = { type: "Logical", op, left: node, right: parseCompare(ctx) };
  }
  return node;
}

function parseExpression(ctx) {
  let node = parseLogical(ctx);
  if (peek(ctx) === "?") {
    consume(ctx); // ?
    const consequent = parseExpression(ctx);
    if (peek(ctx) === ":") consume(ctx); // :
    const alternate = parseExpression(ctx);
    node = { type: "Ternary", test: node, consequent, alternate };
  }
  return node;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

function evaluate(node, scope) {
  switch (node.type) {
    case "Literal":
      return node.value;

    case "Identifier":
      return resolvePath(scope, node.name);

    case "Unary":
      if (node.op === "-") return -evaluate(node.value, scope);
      if (node.op === "!") return !evaluate(node.value, scope);
      return "";

    case "Binary": {
      const l = evaluate(node.left, scope);
      const r = evaluate(node.right, scope);
      if (node.op === "+") return l + r;
      if (node.op === "-") return l - r;
      if (node.op === "*") return l * r;
      if (node.op === "/") return l / r;
      return "";
    }

    case "Compare": {
      const l = evaluate(node.left, scope);
      const r = evaluate(node.right, scope);
      if (node.op === ">")  return l > r;
      if (node.op === "<")  return l < r;
      if (node.op === ">=") return l >= r;
      if (node.op === "<=") return l <= r;
      if (node.op === "==") return l == r;
      if (node.op === "!=") return l != r;
      return false;
    }

    case "Logical": {
      const l = evaluate(node.left, scope);
      if (node.op === "&&") return l ? evaluate(node.right, scope) : l;
      if (node.op === "||") return l ? l : evaluate(node.right, scope);
      return false;
    }

    case "Ternary":
      return evaluate(node.test, scope)
        ? evaluate(node.consequent, scope)
        : evaluate(node.alternate, scope);

    default:
      return "";
  }
}

function resolvePath(scope, path) {
  const parts = path.split(".");
  let current = scope;
  for (const part of parts) {
    if (current == null) return undefined;
    // Support .length on arrays and strings
    if (part === "length" && (Array.isArray(current) || typeof current === "string")) {
      return current.length;
    }
    current = current[part];
  }
  return current;
}

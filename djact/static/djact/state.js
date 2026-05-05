import { evaluateExpression } from "./renderer_expr.js";

export function parseStateString(value) {
  const state = {};
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const [rawKey, rawVal] = part.split("=").map((s) => s.trim());
    if (!rawKey) continue;
    state[rawKey] = parseValue(rawVal);
  }
  return state;
}

export function parseUpdatesString(value, state) {
  const updates = {};
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const [rawKey, rawVal] = splitKeyValue(part);
    if (!rawKey) continue;
    updates[rawKey] = parseUpdateValue(rawVal, state || {});
  }
  return updates;
}

function parseValue(value) {
  if (value === undefined) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value === "undefined") return undefined;
  if (!Number.isNaN(Number(value))) return Number(value);

  if ((value.startsWith("'" ) && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }

  return value;
}

function splitKeyValue(part) {
  const idx = part.indexOf("=");
  if (idx === -1) return [part.trim(), ""]; 
  return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
}

function parseUpdateValue(value, state) {
  if (value === undefined || value === "") return null;
  if (isLiteral(value)) return parseValue(value);
  try {
    return evaluateExpression(value, state);
  } catch {
    return parseValue(value);
  }
}

function isLiteral(value) {
  if (value === "true" || value === "false" || value === "null" || value === "undefined") {
    return true;
  }
  if (!Number.isNaN(Number(value))) return true;
  return (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  );
}

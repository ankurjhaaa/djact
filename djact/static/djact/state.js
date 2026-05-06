/**
 * djact/state.js — State string parsing utilities.
 */
import { evaluateExpression } from "./renderer_expr.js";

/**
 * Parse a dj:state attribute string into a state object.
 * Example: "name='', count=0, visible=true" → {name: "", count: 0, visible: true}
 */
export function parseStateString(value) {
  const state = {};
  if (!value) return state;
  const parts = splitTopLevel(value, ",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    state[key] = parseValue(val);
  }
  return state;
}

/**
 * Parse a setState() argument string.
 * Expressions are evaluated against current state.
 */
export function parseUpdatesString(value, state) {
  const updates = {};
  if (!value) return updates;
  const parts = splitTopLevel(value, ",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    updates[key] = parseUpdateValue(val, state || {});
  }
  return updates;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseValue(value) {
  if (value === undefined || value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "undefined") return null;
  if (!Number.isNaN(Number(value)) && value !== "") return Number(value);

  // Quoted string
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }

  // JSON array / object
  if (value.startsWith("[") || value.startsWith("{")) {
    try { return JSON.parse(value); } catch { /* fall through */ }
  }

  return value;
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
  if (value === "true" || value === "false" || value === "null" || value === "undefined") return true;
  if (!Number.isNaN(Number(value)) && value !== "") return true;
  return (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  );
}

/**
 * Split a string by delimiter, respecting quotes and brackets.
 */
function splitTopLevel(str, delimiter) {
  const parts = [];
  let current = "";
  let depth = 0;
  let inQuote = null;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inQuote) {
      current += ch;
      if (ch === inQuote) inQuote = null;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") { depth++; current += ch; continue; }
    if (ch === ")" || ch === "]" || ch === "}") { depth--; current += ch; continue; }

    if (ch === delimiter && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current);
  return parts;
}

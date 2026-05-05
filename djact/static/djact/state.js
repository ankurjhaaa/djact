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

export function parseUpdatesString(value) {
  return parseStateString(value);
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

// Pure, side-effect-free parsers for the frontend scanner. Kept separate from
// the scanner so they can be unit-tested deterministically.

/** Parse a PostgREST select() payload into columns and nested embeds. */
export function parseSelect(payload) {
  const embeds = [];
  const columns = [];
  let hasStar = false;

  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of payload) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);

  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    if (part === "*") {
      hasStar = true;
      continue;
    }
    const embed = /^(?:[A-Za-z_][A-Za-z0-9_]*\s*:\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:!(inner|left|right))?\s*\(([\s\S]*)\)$/.exec(part);
    if (embed) {
      const innerCols = embed[3]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => c.split("::")[0].trim());
      embeds.push({ relation: embed[1], join: embed[2] ?? "default", columns: innerCols });
      continue;
    }
    columns.push(part.split("::")[0].trim().replace(/^.*:\s*/, "").replace(/^"|"$/g, ""));
  }

  return { hasStar, columns, embeds };
}

/** Extract top-level property keys from a JS object literal body `{ ... }`. */
export function topLevelObjectKeys(body) {
  const keys = [];
  let depth = 0;
  let inStr = null;
  let i = 0;
  const n = body.length;
  let token = "";
  let key = null;
  let pendingTernary = false;

  while (i < n) {
    const ch = body[i];
    const next = body[i + 1];
    if (inStr) {
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inStr = ch;
      i++;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      i++;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      i++;
      continue;
    }
    if (depth === 0) {
      if (ch === "?" && next !== "." && next !== "?") {
        pendingTernary = true;
        i++;
        continue;
      }
      if (ch === ":") {
        if (pendingTernary) pendingTernary = false;
        else key = token.trim();
        token = "";
        i++;
        continue;
      }
      if (ch === ",") {
        if (key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) keys.push(key);
        key = null;
        token = "";
        pendingTernary = false;
        i++;
        continue;
      }
      token += ch;
    }
    i++;
  }
  if (key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) keys.push(key);
  else if (token.trim()) {
    const k = token.split(":")[0].trim();
    if (k && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) keys.push(k);
  }
  return keys;
}

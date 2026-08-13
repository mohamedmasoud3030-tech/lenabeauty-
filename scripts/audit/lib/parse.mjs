// Pure, side-effect-free parsers for the frontend scanner. Kept separate from
// the scanner so they can be unit-tested deterministically.

const IDENT_RE = /^\w/;
const isIdentChar = (c) => IDENT_RE.test(c);
const isSpace = (c) => c === " " || c === "\n" || c === "\t" || c === "\r";

/** Parse a PostgREST select() payload into columns and nested embeds. */
export function parseSelect(payload) {
  const result = { hasStar: false, columns: [], embeds: [] };
  for (const part of splitTopLevel(payload)) {
    applySelectPart(result, part);
  }
  return result;
}

/** Split a payload on top-level commas (ignoring those inside parens). */
function splitTopLevel(payload) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of payload) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

function applySelectPart(result, raw) {
  const part = raw.trim();
  if (!part) return;
  if (part === "*") {
    result.hasStar = true;
    return;
  }
  const embed = parseEmbed(part);
  if (embed) {
    result.embeds.push(embed);
    return;
  }
  result.columns.push(plainColumn(part));
}

/** Parse `relation(cols)`, `alias:relation(cols)`, or `relation!hint(cols)`. */
function parseEmbed(part) {
  const m = /^(?:\w+\s*:\s*)?(\w+)(?:!(inner|left|right))?\s*\(([\s\S]*)\)$/.exec(part);
  if (!m) return null;
  const inner = parseSelect(m[3]);
  const columns = inner.hasStar ? ["*", ...inner.columns] : inner.columns;
  return {
    relation: m[1],
    join: m[2] ?? "default",
    columns,
    embeds: inner.embeds,
  };
}

/** Strip an optional `alias:` prefix and `::cast` suffix from a column name. */
function plainColumn(c) {
  return c.split("::")[0].trim().replace(/^.*:\s*/, "").replace(/^"|"$/g, "");
}

/** Extract top-level property keys from a JS object literal body (no braces). */
export function topLevelObjectKeys(body) {
  const keys = [];
  let i = 0;
  const n = body.length;
  while (i < n) {
    const read = readKey(body, i);
    if (read === null) {
      i += 1;
      continue;
    }
    keys.push(read.name);
    i = read.next;
  }
  return keys;
}

/** Read `name :` at position i; return {name, next} or null. */
function readKey(body, i) {
  const n = body.length;
  let j = i;
  while (j < n && isSpace(body[j])) j += 1;
  let name = "";
  while (j < n && isIdentChar(body[j])) {
    name += body[j];
    j += 1;
  }
  while (j < n && isSpace(body[j])) j += 1;
  if (name === "" || body[j] !== ":") return null;
  return { name, next: skipValue(body, j + 1) };
}

/** Skip a value after `:` up to the next top-level `,` or the closing `}`. */
function skipValue(body, i) {
  const n = body.length;
  let depth = 0;
  let j = i;
  while (j < n) {
    const ch = body[j];
    if (ch === "'" || ch === '"' || ch === "`") {
      j = skipString(body, j);
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth += 1;
      j += 1;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      if (depth === 0) return j;
      depth -= 1;
      j += 1;
      continue;
    }
    if (ch === "," && depth === 0) return j + 1;
    j += 1;
  }
  return n;
}

/** Skip a quoted string starting at `body[i]`; return index just past it. */
function skipString(body, i) {
  const n = body.length;
  const q = body[i];
  let j = i + 1;
  while (j < n) {
    if (body[j] === "\\") {
      j += 2;
      continue;
    }
    if (body[j] === q) return j + 1;
    j += 1;
  }
  return n;
}

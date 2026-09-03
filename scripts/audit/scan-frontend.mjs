// Deterministic scanner for frontend/application database usage.
//
// Walks src/**/*.{ts,tsx} and extracts the database contract surface the app
// depends on: table reads/writes (.from), RPC calls (.rpc with argument names),
// nested PostgREST embeds (.select), storage buckets (.storage.from), row-shape
// filters (.eq/.in/.order/...), and single/maybe-single row expectations.
//
// Emits docs/database-contract/artifacts/frontend-usage.json. No network, no DB.
//
// LIMITATIONS (see `manual_review` + docs/database-contract/02): the scanner
// matches static string literals only. Dynamic/variable table or RPC names,
// computed keys, and non-literal arguments are recorded as manual-review items
// and are NOT proven. RPC overloads are matched by name only; RPC return shapes
// (jsonb/record) and storage bucket policies are not statically resolved.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSelect, topLevelObjectKeys } from "./lib/parse.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACTS_DIR = resolve(ROOT, "docs/database-contract/artifacts");
const SRC_DIR = resolve(ROOT, "src");
const DOMAIN_PORTS_DIR = `${resolve(SRC_DIR, "domain/ports/repositories")}/`;

const isSpace = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";
const byLocale = (a, b) => a.localeCompare(b);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = resolve(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Domain repository ports are pure contracts and cannot own Supabase usage.
// Excluding their split implementation directory keeps this database-usage
// artifact tied to executable DB callers instead of architectural file count.
const sourceFiles = walk(SRC_DIR).filter(
  (p) => /\.(ts|tsx)$/.test(p) && !p.startsWith(DOMAIN_PORTS_DIR),
);

/** Find every `.method(` occurrence; returns `[{start, argsStart}]`. */
function findMethodCalls(source, method) {
  const needle = `.${method}`;
  const results = [];
  let i = 0;
  while (i < source.length) {
    const idx = source.indexOf(needle, i);
    if (idx === -1) break;
    let j = idx + needle.length;
    while (j < source.length && isSpace(source[j])) j += 1;
    if (source[j] === "(") results.push({ start: idx, argsStart: j + 1 });
    i = idx + needle.length;
  }
  return results;
}

/** Read a quoted string literal at argsStart; returns {value, end} or null. */
function readStringArg(source, argsStart) {
  let j = argsStart;
  while (j < source.length && isSpace(source[j])) j += 1;
  const q = source[j];
  if (q !== "'" && q !== '"' && q !== "`") return null;
  return readQuoted(source, j, q);
}

function readQuoted(source, start, q) {
  let j = start + 1;
  let value = "";
  while (j < source.length) {
    const c = source[j];
    if (c === "\\") {
      value += source[j + 1] ?? "";
      j += 2;
      continue;
    }
    if (c === q) return { value, end: j + 1 };
    value += c;
    j += 1;
  }
  return { value, end: j };
}

/** Read a balanced `{ ... }` starting at `source[i] === "{"`; returns body or null. */
function readBracedBody(source, i) {
  if (source[i] !== "{") return null;
  let depth = 0;
  let j = i;
  const n = source.length;
  while (j < n) {
    const c = source[j];
    if (c === "'" || c === '"' || c === "`") {
      j = readQuoted(source, j, c).end;
      continue;
    }
    if (c === "{") depth += 1;
    if (c === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(i + 1, j);
    }
    j += 1;
  }
  return null;
}

/** Resolve a TS union of string literals declared for identifier `ident`. */
function resolveRpcUnion(source, ident) {
  const re = new RegExp(String.raw`\b${ident}\s*:\s*("(?:[^"\\]|\\.)*"(?:\s*\|\s*"(?:[^"\\]|\\.)*")*)`);
  const m = re.exec(source);
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
}

const usage = {
  files: sourceFiles.length,
  tables: [],
  rpc: [],
  storage: [],
  manual_review: [],
};

const tableMap = new Map();
const rpcMap = new Map();
const storageSet = new Set();
const manualReview = new Map();

function noteManualReview(key, reason, rel) {
  if (!manualReview.has(key)) manualReview.set(key, { reason, files: [] });
  const entry = manualReview.get(key);
  if (!entry.files.includes(rel)) entry.files.push(rel);
}

function registerTable(name, rel) {
  if (!tableMap.has(name)) tableMap.set(name, { table: name, files: [], selects: [], filters: [], single: [] });
  const entry = tableMap.get(name);
  if (!entry.files.includes(rel)) entry.files.push(rel);
  return entry;
}

function registerRpc(name, args, rel) {
  if (!rpcMap.has(name)) rpcMap.set(name, { name, files: [], args: new Set() });
  const entry = rpcMap.get(name);
  if (!entry.files.includes(rel)) entry.files.push(rel);
  for (const a of args) entry.args.add(a);
  return entry;
}

/** True if the token immediately before `.from` is `Array` or `Buffer`. */
function isArrayOrBufferFrom(source, start) {
  let j = start - 1;
  let word = "";
  while (j >= 0 && /\w/.test(source[j])) {
    word = source[j] + word;
    j -= 1;
  }
  return word === "Array" || word === "Buffer";
}

/** Index of the previous non-whitespace char before `i`, or -1. */
function prevNonSpace(source, i) {
  let j = i;
  while (j >= 0 && isSpace(source[j])) j -= 1;
  return j >= 0 ? source[j] : "";
}

/** Resolve a `const NAME = 'literal'` / template-literal in the same file. */
function resolveConstTemplate(source, ident) {
  const re = new RegExp(String.raw`\b${ident}\s*=\s*`);
  const m = re.exec(source);
  if (!m) return null;
  const pos = m.index + m[0].length;
  const q = source[pos];
  if (q !== "'" && q !== '"' && q !== "`") return null;
  return readQuoted(source, pos, q).value;
}

for (const path of sourceFiles) {
  const rel = relative(ROOT, path);
  const source = readFileSync(path, "utf8");

  // --- tables + storage buckets: .from('x') --------------------------------
  const froms = [];
  for (const call of findMethodCalls(source, "from")) {
    const arg = readStringArg(source, call.argsStart);
    if (arg === null) {
      if (!isArrayOrBufferFrom(source, call.start)) {
        noteManualReview("dynamic-from", "non-literal .from() argument (non-Supabase or dynamic)", rel);
      }
      continue;
    }
    const isStorage = source.slice(call.start - ".storage".length, call.start) === ".storage";
    if (isStorage) {
      storageSet.add(arg.value.trim());
      continue;
    }
    const table = arg.value.trim();
    if (!table || table.includes(" ")) continue;
    registerTable(table, rel);
    froms.push({ index: call.start, table });
  }

  // --- select payloads -----------------------------------------------------
  for (const call of findMethodCalls(source, "select")) {
    const arg = readStringArg(source, call.argsStart);
    if (arg === null) {
      // Empty `.select()`: chained Supabase (preceded by `)`) => all columns;
      // otherwise a DOM `.select()` (e.g. textarea.select()) => ignore.
      let j = call.argsStart;
      while (j < source.length && isSpace(source[j])) j += 1;
      if (source[j] === ")") {
        if (prevNonSpace(source, call.start - 1) === ")") {
          const table = nearestTable(froms, call.start);
          if (table) registerTable(table, rel).selects.push(parseSelect("*"));
        }
        continue;
      }
      const identMatch = /^(\w+)/.exec(source.slice(j));
      if (identMatch) {
        const resolved = resolveConstTemplate(source, identMatch[1]);
        if (resolved !== null) {
          const table = nearestTable(froms, call.start);
          if (table) registerTable(table, rel).selects.push(parseSelect(resolved));
          continue;
        }
      }
      noteManualReview("dynamic-select", "non-literal .select() argument", rel);
      continue;
    }
    const table = nearestTable(froms, call.start);
    if (table) registerTable(table, rel).selects.push(parseSelect(arg.value));
  }

  // --- filters -------------------------------------------------------------
  const filterMethods = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "ilike", "like", "contains", "order", "match", "filter"];
  for (const method of filterMethods) {
    for (const call of findMethodCalls(source, method)) {
      const arg = readStringArg(source, call.argsStart);
      if (arg === null) continue;
      const col = arg.value.split(",")[0].split("::")[0].trim();
      if (!col || col.includes(" ")) continue;
      const table = nearestTable(froms, call.start);
      if (table) {
        const f = registerTable(table, rel).filters;
        if (!f.includes(col)) f.push(col);
      }
    }
  }

  // --- single / maybeSingle ------------------------------------------------
  for (const method of ["maybeSingle", "single"]) {
    for (const call of findMethodCalls(source, method)) {
      const table = nearestTable(froms, call.start);
      if (table) registerTable(table, rel).single.push(method);
    }
  }

  // --- RPC calls -----------------------------------------------------------
  for (const call of findMethodCalls(source, "rpc")) {
    const nameArg = readStringArg(source, call.argsStart);
    if (nameArg === null) {
      // dynamic `.rpc(ident, ...)`: try to resolve a union-of-literals type.
      let j = call.argsStart;
      while (j < source.length && isSpace(source[j])) j += 1;
      const identMatch = /^(\w+)/.exec(source.slice(j));
      if (identMatch) {
        const names = resolveRpcUnion(source, identMatch[1]);
        if (names?.length) {
          for (const name of names) registerRpc(name, [], rel);
          continue;
        }
      }
      noteManualReview("dynamic-rpc", "non-literal .rpc() name", rel);
      continue;
    }
    const name = nameArg.value.trim();
    if (!name || name.includes(" ")) continue;
    const args = [];
    let j = nameArg.end;
    while (j < source.length && isSpace(source[j])) j += 1;
    if (source[j] === ",") {
      j += 1;
      while (j < source.length && isSpace(source[j])) j += 1;
      if (source[j] === "{") {
        const body = readBracedBody(source, j);
        if (body !== null) args.push(...topLevelObjectKeys(body));
        else noteManualReview(`rpc-args:${name}`, "unbalanced .rpc() args object", rel);
      } else {
        noteManualReview(`rpc-args:${name}`, "non-literal .rpc() args", rel);
      }
    }
    registerRpc(name, args, rel);
  }
}

/** Nearest preceding `.from(table)` before `index`; returns table or null. */
function nearestTable(froms, index) {
  for (let i = froms.length - 1; i >= 0; i -= 1) {
    if (froms[i].index < index) return froms[i].table;
  }
  return null;
}

usage.tables = [...tableMap.values()]
  .map((t) => ({ table: t.table, files: t.files, selects: t.selects, filters: [...new Set(t.filters)].sort(byLocale), single: [...new Set(t.single)] }))
  .sort((a, b) => a.table.localeCompare(b.table));
usage.rpc = [...rpcMap.values()]
  .map((r) => ({ name: r.name, files: r.files, args: [...r.args].sort(byLocale) }))
  .sort((a, b) => a.name.localeCompare(b.name));
usage.storage = [...storageSet].sort(byLocale);
usage.manual_review = [...manualReview.entries()]
  .map(([key, v]) => ({ key, reason: v.reason, files: v.files }))
  .sort((a, b) => a.key.localeCompare(b.key));

mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(resolve(ARTIFACTS_DIR, "frontend-usage.json"), JSON.stringify(usage, null, 2) + "\n");

console.log(`scanned ${usage.files} source files; tables=${usage.tables.length} rpc=${usage.rpc.length} storage_buckets=${usage.storage.length} manual_review=${usage.manual_review.length}`);
for (const t of usage.tables) {
  const embeds = [...new Set(t.selects.flatMap((s) => s.embeds.map((e) => e.relation)))];
  console.log(`  table ${t.table}: ${t.files.length} file(s), embeds=[${embeds.join(", ")}]`);
}
for (const r of usage.rpc) console.log(`  rpc ${r.name}: args=[${r.args.join(", ")}]`);
for (const b of usage.storage) console.log(`  storage bucket: ${b}`);
for (const m of usage.manual_review) console.log(`  manual_review ${m.key}: ${m.reason} (${m.files.join(", ")})`);

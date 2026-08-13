// Deterministic scanner for frontend/application database usage.
//
// Walks src/**/*.{ts,tsx} and extracts the database contract surface the app
// depends on: table reads/writes (.from), RPC calls (.rpc with argument names),
// nested PostgREST embeds (.select), storage buckets (.storage.from), row-shape
// filters (.eq/.in/.order/...), and single/maybe-single row expectations.
//
// Emits docs/database-contract/artifacts/frontend-usage.json. No network, no DB.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSelect, topLevelObjectKeys } from "./lib/parse.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACTS_DIR = resolve(ROOT, "docs/database-contract/artifacts");
const SRC_DIR = resolve(ROOT, "src");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const p = resolve(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const sourceFiles = walk(SRC_DIR).filter((p) => /\.(ts|tsx)$/.test(p));

const STRING_RE = /(["'`])((?:(?!\1)[\s\S])*)\1/g;

/** Capture a string literal argument to a named chain method. */
function chainString(source, method) {
  const re = new RegExp(`\\.${method}\\s*\\(\\s*(["'\`])((?:(?!\\1)[\\s\\S])*?)\\1`, "g");
  const out = [];
  let m;
  while ((m = re.exec(source)) !== null) {
    out.push({ index: m.index, value: m[2] });
  }
  return out;
}



const usage = {
  generated_at: new Date().toISOString(),
  files: sourceFiles.length,
  tables: [],
  rpc: [],
  storage: [],
};

const tableMap = new Map();
const rpcMap = new Map();
const storageSet = new Set();

for (const path of sourceFiles) {
  const rel = relative(ROOT, path);
  const source = readFileSync(path, "utf8");

  // --- tables: .from('x') excluding .storage.from('x') -------------------
  for (const { index, value } of chainString(source, "from")) {
    const before = source.slice(Math.max(0, index - 10), index);
    if (/\.storage\s*$/.test(before)) continue; // storage bucket, not a table
    const table = value.trim();
    if (!table || table.includes(" ")) continue;
    if (!tableMap.has(table)) tableMap.set(table, { table, files: [], selects: [], filters: [], single: [] });
    const entry = tableMap.get(table);
    if (!entry.files.includes(rel)) entry.files.push(rel);
  }

  // --- select payloads (associate to nearest preceding .from) ------------
  const froms = [];
  for (const m of source.matchAll(/\.from\s*\(\s*(["'`])((?:(?!\1)[\s\S])*?)\1/g)) {
    const before = source.slice(Math.max(0, m.index - 10), m.index);
    if (/\.storage\s*$/.test(before)) continue;
    froms.push({ index: m.index, table: m[2].trim() });
  }
  for (const { index, value } of chainString(source, "select")) {
    // nearest preceding from
    let table = null;
    for (let i = froms.length - 1; i >= 0; i--) {
      if (froms[i].index < index) {
        table = froms[i].table;
        break;
      }
    }
    if (table && tableMap.has(table)) {
      tableMap.get(table).selects.push(parseSelect(value));
    }
  }

  // --- filters ------------------------------------------------------------
  const filterRe = /\.(eq|neq|gt|gte|lt|lte|in|is|ilike|like|contains|order|match|filter)\s*\(\s*(["'`])((?:(?!\2)[\s\S])*?)\2/g;
  let fm;
  while ((fm = filterRe.exec(source)) !== null) {
    const col = fm[3].split(",")[0].trim().split("::")[0].trim();
    if (!col || col.includes(" ")) continue;
    let table = null;
    for (let i = froms.length - 1; i >= 0; i--) {
      if (froms[i].index < fm.index) { table = froms[i].table; break; }
    }
    if (table && tableMap.has(table)) {
      const f = tableMap.get(table).filters;
      if (!f.includes(col)) f.push(col);
    }
  }

  // --- single / maybeSingle ----------------------------------------------
  const singleRe = /\.(maybeSingle|single)\s*\(\s*\)/g;
  let sm;
  while ((sm = singleRe.exec(source)) !== null) {
    let table = null;
    for (let i = froms.length - 1; i >= 0; i--) {
      if (froms[i].index < sm.index) { table = froms[i].table; break; }
    }
    if (table && tableMap.has(table)) tableMap.get(table).single.push(sm[1]);
  }

  // --- RPC calls + argument names ----------------------------------------
  const rpcRe = /\.rpc\s*\(\s*(["'`])([^"'`]+)\1\s*,\s*\{([\s\S]*?)\}/g;
  let rm;
  while ((rm = rpcRe.exec(source)) !== null) {
    const name = rm[2].trim();
    const args = topLevelObjectKeys(rm[3]);
    if (!rpcMap.has(name)) rpcMap.set(name, { name, files: [], args: new Set() });
    const entry = rpcMap.get(name);
    if (!entry.files.includes(rel)) entry.files.push(rel);
    args.forEach((a) => entry.args.add(a));
  }
  // .rpc('name') without an args object
  for (const { index, value } of chainString(source, "rpc")) {
    const name = value.trim();
    if (!name || name.includes(" ")) continue;
    if (!rpcMap.has(name)) rpcMap.set(name, { name, files: [], args: new Set() });
    if (!rpcMap.get(name).files.includes(rel)) rpcMap.get(name).files.push(rel);
  }

  // --- storage buckets ----------------------------------------------------
  for (const { index, value } of chainString(source, "from")) {
    const before = source.slice(Math.max(0, index - 10), index);
    if (/\.storage\s*$/.test(before)) storageSet.add(value.trim());
  }
}

usage.tables = [...tableMap.values()]
  .map((t) => ({ ...t, selects: t.selects, filters: [...new Set(t.filters)] }))
  .sort((a, b) => a.table.localeCompare(b.table));
usage.rpc = [...rpcMap.values()]
  .map((r) => ({ name: r.name, files: r.files, args: [...r.args].sort() }))
  .sort((a, b) => a.name.localeCompare(b.name));
usage.storage = [...storageSet].sort();

mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(resolve(ARTIFACTS_DIR, "frontend-usage.json"), JSON.stringify(usage, null, 2) + "\n");

console.log(
  `scanned ${usage.files} source files; tables=${usage.tables.length} rpc=${usage.rpc.length} storage_buckets=${usage.storage.length}`,
);
for (const t of usage.tables) {
  const embeds = t.selects.flatMap((s) => s.embeds.map((e) => e.relation));
  console.log(
    `  table ${t.table}: ${t.files.length} file(s), embeds=[${[...new Set(embeds)].join(", ")}]`,
  );
}
for (const r of usage.rpc) console.log(`  rpc ${r.name}: args=[${r.args.join(", ")}]`);
for (const b of usage.storage) console.log(`  storage bucket: ${b}`);

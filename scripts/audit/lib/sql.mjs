// Shared helpers for the Lena Beauty database contract audit.
//
// This module contains only deterministic, side-effect-free utilities:
// migration discovery, canonical ordering, a dollar-quote-aware SQL statement
// splitter, the PGlite compatibility preamble, and the documented translation
// layer for constructs that PGlite cannot natively execute.
//
// No remote database is contacted, and no data is mutated.

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const MIGRATIONS_DIR = "supabase/migrations";
export const MANUAL_BOOTSTRAP_FILE = "20260628000002_admin_bootstrap.sql";

/** Lexicographically sorted migration list (canonical order). */
export function discoverMigrations(dir = MIGRATIONS_DIR) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  return files.map((file) => ({
    file,
    id: file.split("_")[0],
    content: readFileSync(resolve(dir, file), "utf8"),
  }));
}

/** The 28 automated migrations: everything except the documented manual bootstrap. */
export function automatedMigrations(migrations = discoverMigrations()) {
  return migrations.filter((m) => m.file !== MANUAL_BOOTSTRAP_FILE);
}

// --- statement splitting ---------------------------------------------------

const isWordChar = (c) => (c >= "0" && c <= "9") || (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_";

/** If `sql[i]` starts a skip-able token, return the index just past it; else -1. */
function skipTokenEnd(sql, i, n) {
  const ch = sql[i];
  const next = sql[i + 1];

  if (ch === "-" && next === "-") {
    let j = i;
    while (j < n && sql[j] !== "\n") j += 1;
    return j;
  }
  if (ch === "/" && next === "*") {
    let j = i + 2;
    while (j < n && !(sql[j] === "*" && sql[j + 1] === "/")) j += 1;
    return Math.min(n, j + 2);
  }
  if (ch === "$") {
    return dollarQuoteEnd(sql, i, n);
  }
  if (ch === "'") {
    return singleQuoteEnd(sql, i, n);
  }
  if (ch === '"') {
    let j = i + 1;
    while (j < n && sql[j] !== '"') j += 1;
    return Math.min(n, j + 1);
  }
  return -1;
}

/** End index of a dollar-quoted string starting at `sql[i] === "$"`, or -1 if not a tag. */
function dollarQuoteEnd(sql, i, n) {
  let j = i + 1;
  while (j < n && isWordChar(sql[j])) j += 1;
  if (sql[j] !== "$") return -1;
  const tag = sql.slice(i, j + 1);
  const close = sql.indexOf(tag, j + 1);
  return close === -1 ? n : close + tag.length;
}

/** End index of a single-quoted string starting at `sql[i] === "'"`. */
function singleQuoteEnd(sql, i, n) {
  let j = i + 1;
  while (j < n) {
    if (sql[j] === "'" && sql[j + 1] === "'") {
      j += 2;
      continue;
    }
    if (sql[j] === "'") return j + 1;
    j += 1;
  }
  return n;
}

/**
 * Split a SQL script into top-level statements on `;`, honouring single-quoted
 * strings, double-quoted identifiers, line/block comments, and dollar-quoted
 * bodies. Returns non-empty, trimmed statements (without the trailing `;`).
 */
export function splitStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const skipEnd = skipTokenEnd(sql, i, n);
    if (skipEnd !== -1) {
      current += sql.slice(i, skipEnd);
      i = skipEnd;
      continue;
    }
    if (ch === ";") {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/**
 * Compatibility preamble executed before replay so the canonical migrations
 * resolve against PGlite, which ships a bare PostgreSQL (no Supabase auth /
 * storage schemas, no `anon` / `authenticated` roles).
 */
export function compatPreamble() {
  return [
    "CREATE ROLE anon",
    "CREATE ROLE authenticated",
    "CREATE SCHEMA IF NOT EXISTS auth",
    `CREATE TABLE IF NOT EXISTS auth.users (
       id uuid PRIMARY KEY,
       raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
     )`,
    `CREATE OR REPLACE FUNCTION auth.uid()
     RETURNS uuid
     LANGUAGE sql STABLE
     AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$`,
    "CREATE SCHEMA IF NOT EXISTS storage",
    `CREATE TABLE IF NOT EXISTS storage.buckets (
       id text PRIMARY KEY,
       name text,
       public boolean
     )`,
    `CREATE TABLE IF NOT EXISTS storage.objects (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       bucket_id text,
       name text,
       owner uuid,
       created_at timestamptz DEFAULT now(),
       updated_at timestamptz DEFAULT now(),
       metadata jsonb DEFAULT '{}'::jsonb
     )`,
  ];
}

// --- translation layer -----------------------------------------------------

const CREATE_EXTENSION_RE = /\bCREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?(\w+)"?/i;

// The exclusion constraint depends on btree_gist's gist `=` operator class,
// which PGlite does not bundle. `[^;]*?` and `[^)]*` are bounded (cannot cross
// `;` or `)`), so this replacement is linear with respect to the input.
const EXCLUDE_RE =
  /ALTER\s+TABLE\s+(?:public\.)?appointments\s+ADD\s+CONSTRAINT\s+appointments_no_scheduled_staff_overlap\s+EXCLUDE\s+USING\s+gist\s*\([^;]*?WHERE\s*\([^)]*\)\s*;/is;

/**
 * Documented, deterministic translation of canonical migration text so it can
 * be replayed against PGlite:
 *
 *  1. `CREATE EXTENSION IF NOT EXISTS ...` is skipped (logged, not run):
 *     `gen_random_uuid()` is PostgreSQL-core since PG13, and `btree_gist` is a
 *     Supabase-hosted contrib extension.
 *  2. The `appointments_no_scheduled_staff_overlap` EXCLUDE constraint is
 *     replaced with a `RAISE NOTICE` surrogate inside its enclosing DO block;
 *     the canonical DDL is preserved verbatim in the inventory.
 *
 * Returns `{ sql, translations }`.
 */
export function translateMigration(content) {
  const translations = [];
  const statements = splitStatements(content);

  const kept = [];
  for (const stmt of statements) {
    const extMatch = CREATE_EXTENSION_RE.exec(stmt);
    if (extMatch) {
      translations.push({
        type: "extension-skipped",
        detail: `CREATE EXTENSION ${extMatch[1]} (provided by Supabase host; not bundled in PGlite)`,
      });
      continue;
    }
    kept.push(stmt);
  }

  let sql = kept.join(";\n") + ";\n";
  if (EXCLUDE_RE.test(sql)) {
    sql = sql.replace(
      EXCLUDE_RE,
      "RAISE NOTICE 'replay: appointments_no_scheduled_staff_overlap EXCLUDE constraint preserved from canonical SQL (btree_gist unavailable in PGlite)';",
    );
    translations.push({
      type: "exclude-constraint-surrogated",
      detail:
        "appointments_no_scheduled_staff_overlap EXCLUDE (btree_gist gist `=` opclass) recorded as canonical-only",
    });
  }

  return { sql, translations };
}

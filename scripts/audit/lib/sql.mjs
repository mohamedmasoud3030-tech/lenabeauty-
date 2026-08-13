// Shared helpers for the Lena Beauty database contract audit.
//
// This module contains *only* deterministic, side-effect-free utilities:
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

/**
 * Split a SQL script into top-level statements on `;`, honouring:
 *   - single-quoted strings ('' escape),
 *   - double-quoted identifiers,
 *   - line comments (`--`) and block comments (/* ... *​/),
 *   - dollar-quoted bodies (`$$ ... $$`, `$tag$ ... $tag$`).
 *
 * Returns non-empty, trimmed statements (without the trailing `;`).
 */
export function splitStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Line comment.
    if (ch === "-" && next === "-") {
      const start = i;
      while (i < n && sql[i] !== "\n") i++;
      current += sql.slice(start, i);
      continue;
    }

    // Block comment.
    if (ch === "/" && next === "*") {
      const start = i;
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i = Math.min(n, i + 2);
      current += sql.slice(start, i);
      continue;
    }

    // Dollar-quoted string.
    if (ch === "$") {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (tag) {
        const start = i;
        i += tag[0].length;
        while (i < n && sql.slice(i, i + tag[0].length) !== tag[0]) i++;
        i = Math.min(n, i + tag[0].length);
        current += sql.slice(start, i);
        continue;
      }
    }

    // Single-quoted string.
    if (ch === "'") {
      const start = i;
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      current += sql.slice(start, i);
      continue;
    }

    // Double-quoted identifier.
    if (ch === '"') {
      const start = i;
      i++;
      while (i < n && sql[i] !== '"') i++;
      i = Math.min(n, i + 1);
      current += sql.slice(start, i);
      continue;
    }

    if (ch === ";") {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/**
 * Compatibility preamble executed before replay so the canonical migrations
 * resolve against PGlite, which ships a bare PostgreSQL (no Supabase auth /
 * storage schemas, no `anon` / `authenticated` roles).
 *
 * These stubs mirror ONLY the subset of the Supabase-managed schema that the
 * canonical migrations reference (auth.users, auth.uid(), storage.buckets,
 * storage.objects). They are deterministic and are never persisted anywhere.
 */
export function compatPreamble() {
  return [
    // Roles referenced by GRANT / REVOKE in canonical migrations.
    "CREATE ROLE anon",
    "CREATE ROLE authenticated",
    // auth schema: only what migrations reference (auth.users + auth.uid()).
    "CREATE SCHEMA IF NOT EXISTS auth",
    `CREATE TABLE IF NOT EXISTS auth.users (
       id uuid PRIMARY KEY,
       raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
     )`,
    `CREATE OR REPLACE FUNCTION auth.uid()
     RETURNS uuid
     LANGUAGE sql STABLE
     AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$`,
    // storage schema: only what migrations reference.
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

/** Statements that must be skipped because PGlite lacks the host extension. */
const SKIPPABLE_EXTENSION = /^\s*CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS/i;

/**
 * Documented, deterministic translation of canonical migration text so it can
 * be replayed against PGlite:
 *
 *  1. `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` — skipped: `gen_random_uuid()`
 *     is a PostgreSQL-core function since PG13 (PGlite ships PG 18.3), so no
 *     pgcrypto is required by any canonical migration.
 *  2. `CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions` —
 *     skipped: btree_gist is a Supabase-hosted contrib extension that PGlite
 *     does not bundle.
 *  3. The `appointments_no_scheduled_staff_overlap` EXCLUDE constraint depends
 *     on btree_gist's gist operator class for `=`; it is replaced with a
 *     NOTICE surrogate so the enclosing DO block still executes. The canonical
 *     EXCLUDE DDL is preserved verbatim in the schema inventory with
 *     `replayable: false`.
 *
 * Returns `{ sql, translations }` where `translations` is a list of
 * `{ type, file, detail }` records for the report.
 */
export function translateMigration(content) {
  const translations = [];
  let sql = content;

  // 1 + 2: strip extension creation statements (they are logged, not run).
  sql = sql.replace(
    /^\s*CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+[^;]+;\s*$/gim,
    (m) => {
      const ext = /([A-Za-z0-9_"]+)\s*;?\s*$/.exec(m.trim())?.[1] ?? "unknown";
      translations.push({
        type: "extension-skipped",
        detail: `CREATE EXTENSION ${ext} (provided by Supabase host; not bundled in PGlite)`,
      });
      return "";
    },
  );

  // 3: EXCLUDE constraint (btree_gist gist `=` operator class unavailable).
  const excludePattern =
    /ALTER\s+TABLE\s+(?:public\.)?appointments\s+ADD\s+CONSTRAINT\s+appointments_no_scheduled_staff_overlap\s+EXCLUDE\s+USING\s+gist\s*\([\s\S]*?\)\s*WHERE\s*\([^)]*\)\s*;/i;
  if (excludePattern.test(sql)) {
    sql = sql.replace(
      excludePattern,
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

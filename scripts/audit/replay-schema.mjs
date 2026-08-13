// Deterministic local schema replay + catalog inventory for the database
// contract freeze audit.
//
// Replays the 28 canonical automated migrations against PGlite (bare PostgreSQL
// 18.3) with per-file rollback, verifies idempotency by re-running the chain,
// computes a deterministic catalog fingerprint before and after, and extracts
// the replayed schema (tables, columns, enums, constraints, FKs, indexes,
// triggers, views, functions incl. search_path, policies, grants resolved to
// role names) from the live catalog.
//
// The one documented manual bootstrap migration is excluded. Output is written
// to docs/database-contract/artifacts/ and is fully reproducible.

import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  discoverMigrations,
  automatedMigrations,
  MANUAL_BOOTSTRAP_FILE,
  compatPreamble,
  translateMigration,
  splitStatements,
} from "./lib/sql.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ARTIFACTS_DIR = resolve(ROOT, "docs/database-contract/artifacts");

const all = discoverMigrations();
const automated = automatedMigrations(all);
const manual = all.filter((m) => m.file === MANUAL_BOOTSTRAP_FILE);

const db = new PGlite();
for (const stmt of compatPreamble()) await db.exec(stmt);

const report = {
  engine: "PGlite",
  postgres: "",
  discovered: {
    total: all.length,
    automated: automated.length,
    manual_bootstrap_excluded: manual.length,
    manual_bootstrap_file: MANUAL_BOOTSTRAP_FILE,
  },
  replay: [],
  idempotency: [],
  translations: [],
  fingerprints: {},
};

{
  const { rows } = await db.query(
    "SELECT version() AS v, current_setting('server_version_num') AS n",
  );
  report.postgres = rows[0].v;
}

// --- Pass 1: first full replay (per-file rollback) -------------------------
for (const migration of automated) {
  const { sql, translations } = translateMigration(migration.content);
  report.translations.push(...translations.map((t) => ({ file: migration.file, ...t })));
  const entry = { file: migration.file, status: "ok", error: null };
  const result = await replayFile(sql);
  entry.status = result.status;
  entry.error = result.error;
  report.replay.push(entry);
}

const inventoryAfterFirst = await buildInventory();
report.fingerprints.after_first_replay = fingerprint(inventoryAfterFirst);

// --- Pass 2: repeat the chain (idempotency evidence) -----------------------
for (const migration of automated) {
  const { sql } = translateMigration(migration.content);
  const entry = { file: migration.file, status: "idempotent", error: null };
  const result = await replayFile(sql);
  if (result.status === "failed") {
    entry.status = "non-idempotent";
    entry.error = result.error;
  }
  report.idempotency.push(entry);
}

const inventoryAfterReplay = await buildInventory();
report.fingerprints.after_repeat = fingerprint(inventoryAfterReplay);
report.fingerprints.identical = report.fingerprints.after_first_replay === report.fingerprints.after_repeat;
report.fingerprints.diff = diffInventories(inventoryAfterFirst, inventoryAfterReplay);

// The canonical schema is the FIRST application (28 migrations applied once).
// Canonical-only objects captured from SQL text that PGlite cannot execute.
inventoryAfterFirst.canonical_only = canonicalOnlyObjects();

mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(resolve(ARTIFACTS_DIR, "replay-report.json"), JSON.stringify(report, null, 2) + "\n");
writeFileSync(resolve(ARTIFACTS_DIR, "schema-inventory.json"), JSON.stringify(inventoryAfterFirst, null, 2) + "\n");

await db.close();

const inv = inventoryAfterFirst;
const failed = report.replay.filter((e) => e.status === "failed");
const nonIdem = report.idempotency.filter((e) => e.status === "non-idempotent");

console.log(
  `full canonical migration discovery; ${automated.length} automated migrations replayed; ${manual.length} documented manual bootstrap excluded.`,
);
console.log(`replay failures: ${failed.length}`);
for (const f of failed) console.log(`  FAIL ${f.file}: ${f.error}`);
console.log(`idempotency failures: ${nonIdem.length}`);
for (const f of nonIdem) console.log(`  NON-IDEMPOTENT ${f.file}: ${f.error}`);
console.log(
  `fingerprint after_first=${report.fingerprints.after_first_replay} after_repeat=${report.fingerprints.after_repeat} identical=${report.fingerprints.identical}`,
);

// Only unexpected replay failures fail the replay step; the two documented
// idempotency gaps and their fingerprint drift are reported, not fatal.
if (failed.length) process.exitCode = 1;

// --- helpers ---------------------------------------------------------------

/** Deterministic SHA-256 fingerprint of the schema catalog (timestamps excluded). */
function fingerprint(inventory) {
  const { generated_at, canonical_only, ...stable } = inventory;
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/** Normalize PGlite's `pg_get_userbyid(0)` output to the PUBLIC role name. */
function roleName(raw) {
  if (raw === "" || raw === "unknown (OID=0)") return "public";
  return raw;
}

/** Structural diff between two inventories, keyed by section. */
function diffInventories(a, b) {
  const sections = [
    "tables",
    "columns",
    "enums",
    "constraints",
    "foreign_keys",
    "indexes",
    "triggers",
    "views",
    "functions",
    "function_acl",
    "policies",
    "grants",
    "rls_enabled",
    "default_acl",
  ];
  const diff = { changed_sections: [], functions: [] };
  for (const section of sections) {
    if (JSON.stringify(a[section]) !== JSON.stringify(b[section])) {
      diff.changed_sections.push(section);
    }
  }
  if (diff.changed_sections.includes("functions")) {
    const key = (f) => `${f.schema}.${f.name}(${f.identity_args})`;
    const mapB = new Map(b.functions.map((f) => [key(f), f]));
    for (const fa of a.functions) {
      const fb = mapB.get(key(fa));
      const configA = JSON.stringify(fa.config ?? null);
      const configB = JSON.stringify(fb?.config ?? null);
      if (configA !== configB || (fb?.security_definer ?? null) !== (fa.security_definer ?? null)) {
        diff.functions.push({
          function: key(fa),
          before: { config: fa.config ?? null, security_definer: fa.security_definer },
          after: { config: fb?.config ?? null, security_definer: fb?.security_definer ?? null },
        });
      }
    }
  }
  return diff;
}

function hasExplicitTransaction(sql) {
  const statements = new Set(splitStatements(sql).map((s) => s.trim().toUpperCase()));
  return statements.has("BEGIN") && statements.has("COMMIT");
}

function firstLine(err) {
  return String(err?.message ?? err).split("\n")[0];
}

/** Replay one translated migration with per-file atomicity (rollback on failure). */
async function replayFile(sql) {
  const wrapped = !hasExplicitTransaction(sql);
  if (wrapped) await db.exec("BEGIN");
  try {
    await db.exec(sql);
    if (wrapped) await db.exec("COMMIT");
    return { status: "ok", error: null };
  } catch (err) {
    await resetTransaction();
    return { status: "failed", error: firstLine(err) };
  }
}

/** Roll back any open/aborted transaction left by a failing migration. */
async function resetTransaction() {
  try {
    await db.exec("ROLLBACK");
  } catch {
    /* no open transaction — ignore */
  }
}

async function buildInventory() {
  const q = async (sql) => (await db.query(sql)).rows;
  const inventory = {};
  inventory.tables = await qTables(q);
  inventory.columns = await qColumns(q);
  inventory.enums = await qEnums(q);
  inventory.constraints = await qConstraints(q);
  inventory.foreign_keys = await qForeignKeys(q);
  inventory.indexes = await qIndexes(q);
  inventory.triggers = await qTriggers(q);
  inventory.views = await qViews(q);
  inventory.functions = await qFunctions(q);
  inventory.function_acl = (await qFunctionAcl(q)).map((r) => ({ ...r, grantee: roleName(r.grantee) }));
  inventory.policies = await qPolicies(q);
  inventory.grants = (await qGrants(q)).map((r) => ({ ...r, grantee: roleName(r.grantee) }));
  inventory.rls_enabled = await qRls(q);
  inventory.default_acl = await qDefaultAcl(q);
  return inventory;
}

async function qTables(q) {
  return q(`SELECT table_schema AS schema, table_name AS name
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'app_private') AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name`);
}

async function qColumns(q) {
  return q(`SELECT table_schema AS schema, table_name AS table, column_name AS name,
           data_type AS type, udt_name AS udt, is_nullable AS nullable,
           column_default AS default, ordinal_position AS position
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'app_private')
    ORDER BY table_schema, table_name, ordinal_position`);
}

async function qEnums(q) {
  return q(`SELECT n.nspname AS schema, t.typname AS name, e.enumlabel AS label, e.enumsortorder AS position
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('public', 'app_private')
    ORDER BY n.nspname, t.typname, e.enumsortorder`);
}

async function qConstraints(q) {
  return q(`SELECT n.nspname AS schema, c.relname AS table, con.conname AS name, con.contype AS type,
           pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'app_private') AND con.contype <> 'f'
    ORDER BY n.nspname, c.relname, con.conname`);
}

async function qForeignKeys(q) {
  return q(`SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
           pg_get_constraintdef(con.oid) AS definition,
           fn.nspname AS ref_schema, fc.relname AS ref_table
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class fc ON fc.oid = con.confrelid
    JOIN pg_namespace fn ON fn.oid = fc.relnamespace
    WHERE n.nspname IN ('public', 'app_private') AND con.contype = 'f'
    ORDER BY n.nspname, c.relname, con.conname`);
}

async function qIndexes(q) {
  return q(`SELECT n.nspname AS schema, t.relname AS table, i.relname AS name,
           ix.indisunique AS unique, ix.indisprimary AS primary, am.amname AS method,
           pg_get_indexdef(i.oid) AS definition
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname IN ('public', 'app_private')
    ORDER BY n.nspname, t.relname, i.relname`);
}

async function qTriggers(q) {
  return q(`SELECT n.nspname AS schema, c.relname AS table, t.tgname AS name,
           pg_get_triggerdef(t.oid) AS definition, t.tgenabled <> 'D' AS enabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'app_private') AND NOT t.tgisinternal
    ORDER BY n.nspname, c.relname, t.tgname`);
}

async function qViews(q) {
  return q(`SELECT table_schema AS schema, table_name AS name, view_definition AS definition
    FROM information_schema.views
    WHERE table_schema IN ('public', 'app_private')
    ORDER BY table_schema, table_name`);
}

async function qFunctions(q) {
  return q(`SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS identity_args,
           pg_get_function_result(p.oid) AS result,
           p.prosecdef AS security_definer, p.provolatile AS volatility,
           p.prorettype::regtype::text AS return_type,
           p.proconfig AS config,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private') AND p.prokind = 'f'
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`);
}

async function qFunctionAcl(q) {
  return q(`SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS identity_args,
           pg_get_userbyid(a.grantee) AS grantee, a.privilege_type AS privilege
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname IN ('public', 'app_private') AND p.prokind = 'f'
    ORDER BY n.nspname, p.proname, grantee, privilege`);
}

async function qPolicies(q) {
  return q(`SELECT schemaname AS schema, tablename AS table, policyname AS name,
           permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'app_private')
    ORDER BY schemaname, tablename, policyname`);
}

async function qGrants(q) {
  return q(`SELECT 'relation' AS kind, n.nspname AS schema, c.relname AS object,
           pg_get_userbyid(a.grantee) AS grantee, a.privilege_type AS privilege
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
    WHERE n.nspname IN ('public', 'app_private')
    UNION ALL
    SELECT 'routine' AS kind, n.nspname AS schema, p.proname AS object,
           pg_get_userbyid(a.grantee) AS grantee, a.privilege_type AS privilege
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname IN ('public', 'app_private')
    UNION ALL
    SELECT 'schema' AS kind, n.nspname AS schema, n.nspname AS object,
           pg_get_userbyid(a.grantee) AS grantee, a.privilege_type AS privilege
    FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
    WHERE n.nspname IN ('public', 'app_private')
    ORDER BY kind, schema, object, grantee, privilege`);
}

async function qRls(q) {
  return q(`SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'app_private') AND c.relkind = 'r'
    ORDER BY n.nspname, c.relname`);
}

async function qDefaultAcl(q) {
  return q(`SELECT n.nspname AS schema, pg_get_userbyid(d.defaclrole) AS owner,
           CASE d.defaclobjtype WHEN 'r' THEN 'relation' WHEN 'f' THEN 'function' WHEN 'n' THEN 'schema' END AS objtype,
           array_to_string(d.defaclacl::text[], ', ') AS acl
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    ORDER BY n.nspname, d.defaclobjtype`);
}

/** Canonical contract objects that PGlite cannot natively execute. */
function canonicalOnlyObjects() {
  return {
    extensions: [
      { name: "pgcrypto", note: "Only gen_random_uuid() is used, which is PostgreSQL-core since PG13; extension is a Supabase-host safety net." },
      { name: "btree_gist", note: "Required for the appointments_no_scheduled_staff_overlap EXCLUDE gist `=` operator class; not bundled in PGlite." },
    ],
    constraints: [
      {
        name: "appointments_no_scheduled_staff_overlap",
        table: "public.appointments",
        type: "EXCLUDE",
        definition:
          "EXCLUDE USING gist (center_id WITH =, employee_id WITH =, tsrange(date_time AT TIME ZONE 'UTC', (date_time AT TIME ZONE 'UTC') + duration_minutes_snapshot * INTERVAL '1 minute', '[)') WITH &&) WHERE (status = 'SCHEDULED')",
        replayable: false,
        reason: "btree_gist gist operator class unavailable in PGlite",
      },
    ],
    manual_bootstrap: MANUAL_BOOTSTRAP_FILE,
  };
}

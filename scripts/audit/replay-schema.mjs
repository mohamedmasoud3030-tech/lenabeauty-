// Deterministic local schema replay + catalog inventory for the database
// contract freeze audit.
//
// Replays the 28 canonical automated migrations against PGlite (bare PostgreSQL
// 18.3), verifies per-migration idempotency, and extracts the replayed schema
// (tables, columns, enums, constraints, foreign keys, indexes, triggers, views,
// functions, policies, grants) from the live catalog.
//
// The one documented manual bootstrap migration is excluded. Output is written
// to docs/database-contract/artifacts/ and is fully reproducible.

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

async function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const db = new PGlite();

  // --- Compatibility preamble (auth/storage/roles) -------------------------
  for (const stmt of compatPreamble()) {
    await db.exec(stmt);
  }

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
  };

  const { rows } = await db.query(
    "SELECT version() AS v, current_setting('server_version_num') AS n",
  );
  report.postgres = rows[0].v;

  // --- Replay pass ---------------------------------------------------------
  for (const migration of automated) {
    const entry = { file: migration.file, status: "ok", statements: 0, error: null };
    const { sql, translations } = translateMigration(migration.content);
    entry.translations = translations;
    report.translations.push(
      ...translations.map((t) => ({ file: migration.file, ...t })),
    );
    try {
      await db.exec(sql);
      entry.statements = splitStatements(sql).length;
    } catch (err) {
      entry.status = "failed";
      entry.error = String(err?.message ?? err).split("\n")[0];
      await resetTransaction(db);
      // Bisect to localize the failing statement for diagnostics.
      entry.failing_statement = await localizeFailure(db, sql);
      await resetTransaction(db);
    }
    report.replay.push(entry);
  }

  // --- Idempotency pass (full chain re-run) --------------------------------
  for (const migration of automated) {
    const entry = { file: migration.file, status: "idempotent", error: null };
    const { sql } = translateMigration(migration.content);
    try {
      await db.exec(sql);
    } catch (err) {
      entry.status = "non-idempotent";
      entry.error = String(err?.message ?? err).split("\n")[0];
      await resetTransaction(db);
    }
    report.idempotency.push(entry);
  }

  const failed = report.replay.filter((e) => e.status === "failed");
  const nonIdem = report.idempotency.filter((e) => e.status === "non-idempotent");

  // --- Catalog inventory ---------------------------------------------------
  const inventory = await buildInventory(db);

  // Canonical-only objects captured from SQL text that PGlite cannot execute.
  inventory.canonical_only = canonicalOnlyObjects();

  writeFileSync(
    resolve(ARTIFACTS_DIR, "replay-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(
    resolve(ARTIFACTS_DIR, "schema-inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );

  await db.close();

  // --- Console summary ------------------------------------------------------
  console.log(
    `full canonical migration discovery; ${automated.length} automated migrations replayed; ${manual.length} documented manual bootstrap excluded.`,
  );
  console.log(`replay failures: ${failed.length}`);
  for (const f of failed) console.log(`  FAIL ${f.file}: ${f.error}`);
  console.log(`idempotency failures: ${nonIdem.length}`);
  for (const f of nonIdem) console.log(`  NON-IDEMPOTENT ${f.file}: ${f.error}`);
  console.log(
    `tables=${inventory.tables.length} columns=${inventory.columns.length} enums=${inventory.enums.length} constraints=${inventory.constraints.length} fks=${inventory.foreign_keys.length} indexes=${inventory.indexes.length} triggers=${inventory.triggers.length} views=${inventory.views.length} functions=${inventory.functions.length} policies=${inventory.policies.length} grants=${inventory.grants.length}`,
  );

  if (failed.length || nonIdem.length) process.exitCode = 1;
}

/** Roll back any aborted transaction left by a failing migration. */
async function resetTransaction(db) {
  try {
    await db.exec("ROLLBACK");
  } catch {
    /* no open transaction — ignore */
  }
}

/** Bisect a failing script to report the first statement that errors. */
async function localizeFailure(db, sql) {
  const statements = splitStatements(sql);
  // Cumulative prefix execution to find the first failing statement.
  let buf = "";
  for (const stmt of statements) {
    buf += (buf ? "\n" : "") + stmt + ";";
    try {
      await db.exec(buf);
    } catch (err) {
      return { statement: stmt.slice(0, 400), error: String(err?.message ?? err).split("\n")[0] };
    }
  }
  return null;
}

async function buildInventory(db) {
  const q = async (sql) => (await db.query(sql)).rows;
  const inventory = { generated_at: new Date().toISOString() };

  inventory.tables = await q(`
    SELECT table_schema AS schema, table_name AS name
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'app_private')
      AND table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name`);

  inventory.columns = await q(`
    SELECT table_schema AS schema, table_name AS table, column_name AS name,
           data_type AS type, udt_name AS udt, is_nullable AS nullable,
           column_default AS default, ordinal_position AS position
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'app_private')
    ORDER BY table_schema, table_name, ordinal_position`);

  inventory.enums = await q(`
    SELECT n.nspname AS schema, t.typname AS name,
           e.enumlabel AS label, e.enumsortorder AS position
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('public', 'app_private')
    ORDER BY n.nspname, t.typname, e.enumsortorder`);

  inventory.constraints = await q(`
    SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
           con.contype AS type,
           pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND con.contype <> 'f'
    ORDER BY n.nspname, c.relname, con.conname`);

  inventory.foreign_keys = await q(`
    SELECT n.nspname AS schema, c.relname AS table, con.conname AS name,
           pg_get_constraintdef(con.oid) AS definition,
           fn.nspname AS ref_schema, fc.relname AS ref_table
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class fc ON fc.oid = con.confrelid
    JOIN pg_namespace fn ON fn.oid = fc.relnamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND con.contype = 'f'
    ORDER BY n.nspname, c.relname, con.conname`);

  inventory.indexes = await q(`
    SELECT n.nspname AS schema, t.relname AS table, i.relname AS name,
           ix.indisunique AS unique, ix.indisprimary AS primary,
           am.amname AS method,
           pg_get_indexdef(i.oid) AS definition
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname IN ('public', 'app_private')
    ORDER BY n.nspname, t.relname, i.relname`);

  inventory.triggers = await q(`
    SELECT n.nspname AS schema, c.relname AS table, t.tgname AS name,
           pg_get_triggerdef(t.oid) AS definition,
           t.tgenabled <> 'D' AS enabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND NOT t.tgisinternal
    ORDER BY n.nspname, c.relname, t.tgname`);

  inventory.views = await q(`
    SELECT table_schema AS schema, table_name AS name,
           view_definition AS definition
    FROM information_schema.views
    WHERE table_schema IN ('public', 'app_private')
    ORDER BY table_schema, table_name`);

  inventory.functions = await q(`
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS identity_args,
           pg_get_function_result(p.oid) AS result,
           p.prosecdef AS security_definer,
           p.provolatile AS volatility,
           p.prorettype::regtype::text AS return_type,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.prokind = 'f'
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`);

  inventory.policies = await q(`
    SELECT schemaname AS schema, tablename AS table, policyname AS name,
           permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'app_private')
    ORDER BY schemaname, tablename, policyname`);

  inventory.grants = await q(`
    SELECT 'relation' AS kind, n.nspname AS schema, c.relname AS object,
           a.grantee AS grantee, a.privilege_type AS privilege
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
    WHERE n.nspname IN ('public', 'app_private')
    UNION ALL
    SELECT 'routine' AS kind, n.nspname AS schema, p.proname AS object,
           a.grantee AS grantee, a.privilege_type AS privilege
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname IN ('public', 'app_private')
    UNION ALL
    SELECT 'schema' AS kind, n.nspname AS schema, n.nspname AS object,
           a.grantee AS grantee, a.privilege_type AS privilege
    FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
    WHERE n.nspname IN ('public', 'app_private')
    ORDER BY kind, schema, object, grantee, privilege`);

  inventory.rls_enabled = await q(`
    SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND c.relkind = 'r'
    ORDER BY n.nspname, c.relname`);

  inventory.default_acl = await q(`
    SELECT n.nspname AS schema, pg_get_userbyid(d.defaclrole) AS owner,
           CASE d.defaclobjtype WHEN 'r' THEN 'relation' WHEN 'f' THEN 'function' WHEN 'n' THEN 'schema' END AS objtype,
           array_to_string(d.defaclacl::text[], ', ') AS acl
    FROM pg_default_acl d
    JOIN pg_namespace n ON n.oid = d.defaclnamespace
    ORDER BY n.nspname, d.defaclobjtype`);

  return inventory;
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

main();

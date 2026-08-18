// Executable authorization harness for the Lena Beauty database contract.
//
// Purpose: prove — rather than assert on SQL text — what a real Supabase
// client role can and cannot do. The canonical migration chain is replayed
// into PGlite, then queries are executed under `SET ROLE authenticated` with a
// working `auth.uid()`, so BOTH layers of PostgreSQL authorization are
// exercised in the correct order:
//
//   1. table/column GRANTs (checked first; failure => 42501 permission denied)
//   2. row level security policies (checked second; failure => 0 rows / 42501)
//
// This distinction matters. A missing GRANT and a missing RLS policy produce
// very different user-visible symptoms, and the project's previous checks
// (static SQL string matching) could not tell them apart.
//
// IMPORTANT — why PGlite is the right oracle here:
// PGlite is a bare PostgreSQL. It has none of Supabase's historical
// "auto-expose new tables in public" default privileges. Supabase is retiring
// exactly that legacy behaviour (new projects since 2026-05-30; enforced on all
// projects 2026-10-30). So a role test that passes here is a test that passes
// on a freshly provisioned Supabase project, which is precisely the property a
// future Production environment needs.
//
// No remote database is contacted and no data is mutated outside the harness.

import { PGlite } from "@electric-sql/pglite";
import {
  discoverMigrations,
  automatedMigrations,
  compatPreamble,
  translateMigration,
} from "./sql.mjs";

/** Deterministic fixture identifiers reused across the authorization tests. */
export const FIXTURES = {
  centerA: "9a000000-0000-4000-8000-0000000000a1",
  centerB: "9a000000-0000-4000-8000-0000000000b1",
  adminA: "9b000000-0000-4000-8000-0000000000a1",
  staffA: "9b000000-0000-4000-8000-0000000000a2",
  adminB: "9b000000-0000-4000-8000-0000000000b1",
  outsider: "9b000000-0000-4000-8000-0000000000f1",
  employeeA: "9c000000-0000-4000-8000-0000000000a1",
  customerA: "9d000000-0000-4000-8000-0000000000a1",
  customerB: "9d000000-0000-4000-8000-0000000000b1",
};

function hasExplicitTransaction(sql) {
  return /^\s*BEGIN\s*;/m.test(sql) && /^\s*COMMIT\s*;/m.test(sql);
}

/**
 * Replace the constant `auth.uid()` stub from the replay preamble with a
 * session-driven one, so a test can impersonate a specific signed-in user the
 * same way Supabase's PostgREST does (`request.jwt.claim.sub`).
 */
// `GRANT USAGE ON SCHEMA auth` + executable `auth.uid()` reproduce the Supabase
// platform baseline. Supabase provisions these for anon/authenticated on every
// project; without them the harness would report false "permission denied for
// schema auth" failures that do not exist on a real project.
const AUTH_UID_SESSION_SHIM = `
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
`;

/**
 * Replay the canonical automated migration chain into a fresh PGlite instance
 * and install the deterministic multi-tenant fixture set.
 *
 * @returns {Promise<{db: PGlite, failures: string[]}>}
 */
export async function createAuthorizationHarness() {
  const db = new PGlite();
  for (const stmt of compatPreamble()) await db.exec(stmt);

  const failures = [];
  for (const migration of automatedMigrations(discoverMigrations())) {
    const { sql } = translateMigration(migration.content);
    const wrapped = !hasExplicitTransaction(sql);
    if (wrapped) await db.exec("BEGIN");
    try {
      await db.exec(sql);
      if (wrapped) await db.exec("COMMIT");
    } catch (error) {
      try {
        await db.exec("ROLLBACK");
      } catch {
        /* no open transaction */
      }
      failures.push(`${migration.file}: ${String(error?.message ?? error).split("\n")[0]}`);
    }
  }

  await db.exec(AUTH_UID_SESSION_SHIM);
  await seedFixtures(db);
  return { db, failures };
}

async function seedFixtures(db) {
  const f = FIXTURES;
  await db.exec(`
    INSERT INTO public.centers(id, name) VALUES
      ('${f.centerA}', 'Harness center A'),
      ('${f.centerB}', 'Harness center B')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.center_settings(center_id, name, currency) VALUES
      ('${f.centerA}', 'Harness center A', 'OMR'),
      ('${f.centerB}', 'Harness center B', 'OMR')
    ON CONFLICT (center_id) DO NOTHING;

    INSERT INTO auth.users(id) VALUES
      ('${f.adminA}'), ('${f.staffA}'), ('${f.adminB}'), ('${f.outsider}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles(id, full_name) VALUES
      ('${f.adminA}', 'Harness admin A'),
      ('${f.staffA}', 'Harness staff A'),
      ('${f.adminB}', 'Harness admin B'),
      ('${f.outsider}', 'Harness outsider')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.center_memberships(profile_id, center_id, role) VALUES
      ('${f.adminA}', '${f.centerA}', 'ADMIN'),
      ('${f.staffA}', '${f.centerA}', 'STAFF'),
      ('${f.adminB}', '${f.centerB}', 'ADMIN')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.employees(id, center_id, name, role) VALUES
      ('${f.employeeA}', '${f.centerA}', 'Harness employee A', 'Staff')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.customers(id, center_id, name, phone) VALUES
      ('${f.customerA}', '${f.centerA}', 'Harness customer A', '90000001'),
      ('${f.customerB}', '${f.centerB}', 'Harness customer B', '90000002')
    ON CONFLICT (id) DO NOTHING;
  `);
}

/**
 * Run `sql` exactly as the given Supabase client role and signed-in user would,
 * then restore the superuser session.
 *
 * Returns a discriminated result so a caller can distinguish the three
 * outcomes that matter operationally:
 *   - { outcome: "ok", rows }                  query ran
 *   - { outcome: "denied", code: "42501" }     blocked by GRANT (or a policy)
 *   - { outcome: "error", code, message }      anything else (real defect)
 */
export async function asRole(db, { role = "authenticated", uid = null }, sql, params = []) {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await db.exec(`SET LOCAL ROLE ${role}`);
    const result = params.length > 0 ? await db.query(sql, params) : await db.query(sql);
    await db.exec("ROLLBACK");
    return { outcome: "ok", rows: result.rows };
  } catch (error) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      /* already aborted */
    }
    const code = error?.code ?? error?.cause?.code ?? null;
    const message = String(error?.message ?? error);
    if (code === "42501" || /permission denied/i.test(message)) {
      return { outcome: "denied", code: "42501", message };
    }
    return { outcome: "error", code, message };
  }
}

/**
 * Effective privileges that a client role actually holds on a table, resolved
 * from the live catalog (not from migration text).
 */
export async function tablePrivileges(db, table, role = "authenticated") {
  const { rows } = await db.query(
    `SELECT privilege_type
       FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND table_name = $1 AND grantee = $2
      UNION
     SELECT privilege_type
       FROM information_schema.column_privileges
      WHERE table_schema = 'public' AND table_name = $1 AND grantee = $2`,
    [table, role],
  );
  return [...new Set(rows.map((r) => r.privilege_type))].sort();
}

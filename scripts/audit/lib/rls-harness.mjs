import { PGlite } from "@electric-sql/pglite";
import {
  discoverMigrations,
  automatedMigrations,
  compatPreamble,
  translateMigration,
} from "./sql.mjs";

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
      try { await db.exec("ROLLBACK"); } catch {}
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

export async function asRole(db, { role = "authenticated", uid = null }, sql, params = []) {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [uid ?? ""]);
    await db.exec(`SET LOCAL ROLE ${role}`);
    const result = params.length > 0 ? await db.query(sql, params) : await db.query(sql);
    await db.exec("ROLLBACK");
    return { outcome: "ok", rows: result.rows };
  } catch (error) {
    try { await db.exec("ROLLBACK"); } catch {}
    const code = error?.code ?? error?.cause?.code ?? null;
    const message = String(error?.message ?? error);
    if (code === "42501" || /permission denied/i.test(message)) {
      return { outcome: "denied", code: "42501", message };
    }
    return { outcome: "error", code, message };
  }
}

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

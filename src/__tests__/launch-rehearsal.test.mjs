import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { discoverMigrations, automatedMigrations, compatPreamble, translateMigration } from "../../scripts/audit/lib/sql.mjs";
// @ts-ignore — plain-JS launch tooling shipped without type declarations
import { renderMembershipBootstrap } from "../../scripts/launch/render-membership-bootstrap.mjs";
// @ts-ignore — PGlite ships its own types; relaxed here for the WASM import
import { PGlite } from "@electric-sql/pglite";

/**
 * CLIENT LAUNCH REHEARSAL — the customer-provisioning critical path, executed.
 *
 * Every other database test stops one step short of the real launch:
 *   - `audit.replay.test.ts` replays the automated chain but deliberately
 *     EXCLUDES the manual admin bootstrap;
 *   - `membership-provisioning.test.mjs` only asserts the *text* of the
 *     rendered bootstrap and never executes it.
 *
 * Nothing proved that the chain + a real Auth user + the bootstrap actually
 * produce a working administrator on an empty database. A single wrong column
 * name, a missing FK target, or an RLS policy that blocks the membership write
 * would have surfaced for the first time during a live customer launch.
 *
 * This file runs that whole path against a fresh PGlite database, in the same
 * order the provisioner uses (scripts/launch/provision-client-project.mjs):
 *
 *   1. apply every automated migration, discovered from disk, in canonical order
 *   2. confirm the canonical center/settings shell was seeded by migration 1
 *   3. create the Auth user (what Supabase Dashboard → Add user does in step 3)
 *   4. run the rendered bootstrap (what the provisioner executes in step 6)
 *   5. prove the authorization boundary that the app's RLS depends on
 */

const CANONICAL_CENTER_ID = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";
const ADMIN_USER_ID = "9f1c7a54-6b2e-4d3f-8a11-2c5e7b9d4f60";
const OTHER_CENTER_ID = "11111111-2222-3333-4444-555555555555";
const MANUAL_BOOTSTRAP = "20260628000002_admin_bootstrap.sql";

function hasExplicitTransaction(sql) {
  return /^\s*BEGIN\s*;/m.test(sql) && /^\s*COMMIT\s*;/m.test(sql);
}

/**
 * Replays the canonical chain the same way the shipped audit harness does:
 * per-file transaction with rollback on failure, so one broken migration cannot
 * hide the rest.
 */
async function replayAutomatedMigrations(db) {
  const failures = [];
  for (const migration of automatedMigrations(discoverMigrations())) {
    const { sql } = translateMigration(migration.content);
    const wrapped = !hasExplicitTransaction(sql);
    if (wrapped) await db.exec("BEGIN");
    try {
      await db.exec(sql);
      if (wrapped) await db.exec("COMMIT");
    } catch (error) {
      try { await db.exec("ROLLBACK"); } catch { /* no open transaction */ }
      failures.push(`${migration.file}: ${String(error?.message ?? error).split("\n")[0]}`);
    }
  }
  return failures;
}

/**
 * Runs a statement that is expected to fail, then clears the aborted
 * transaction the failure leaves behind.
 *
 * The rendered bootstrap wraps itself in an explicit BEGIN/COMMIT, so when one
 * of its guards raises, PostgreSQL leaves the session in "current transaction
 * is aborted" until something issues ROLLBACK. An operator hitting this in the
 * SQL Editor must run ROLLBACK; before retrying — silently continuing would
 * make every later statement fail for a confusing, unrelated-looking reason.
 */
async function expectRejects(db, sql, pattern) {
  await expect(db.exec(sql)).rejects.toThrow(pattern);
  try {
    await db.exec("ROLLBACK");
  } catch {
    /* no open transaction */
  }
}

async function scalar(db, sql, params) {
  const result = await db.query(sql, params);
  const row = result.rows[0];
  return row ? Object.values(row)[0] : undefined;
}

describe("client launch rehearsal (fresh database → working administrator)", () => {
  let db;
  let bootstrapSql;

  beforeAll(async () => {
    db = new PGlite();
    for (const statement of compatPreamble()) await db.exec(statement);

    // The harness shim only models auth.users(id, raw_user_meta_data). Real
    // Supabase Auth also has raw_app_meta_data, which is the server-owned field
    // the app reads the role from — without it the rehearsal would not exercise
    // the same schema the bootstrap writes to.
    await db.exec("ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb");

    const failures = await replayAutomatedMigrations(db);
    expect(failures).toEqual([]);

    bootstrapSql = renderMembershipBootstrap({
      userId: ADMIN_USER_ID,
      centerId: CANONICAL_CENTER_ID,
      role: "ADMIN",
      fullName: "Salon Owner",
    });
  }, 180_000);

  afterAll(async () => {
    await db?.close?.();
  });

  it("seeds the canonical single-center shell the app expects from VITE_CENTER_ID", async () => {
    expect(await scalar(db, "SELECT name FROM public.centers WHERE id = $1", [CANONICAL_CENTER_ID]))
      .toBeTruthy();
    expect(await scalar(db, "SELECT currency FROM public.center_settings WHERE center_id = $1", [CANONICAL_CENTER_ID]))
      .toBe("OMR");
  });

  it("refuses to run the shipped bootstrap while its placeholder UUID is unedited", async () => {
    const shipped = discoverMigrations().find((migration) => migration.file === MANUAL_BOOTSTRAP).content;

    // Guards a real launch hazard: running the file as-is must fail loudly
    // rather than creating a ghost admin bound to the nil UUID.
    await expect(db.exec(shipped)).rejects.toThrow(/Set v_admin_uid to the real auth\.users UUID/);

    expect(await scalar(db, "SELECT count(*)::int FROM public.center_memberships")).toBe(0);
  });

  it("refuses to bootstrap an Auth user that does not exist yet", async () => {
    // Ordering guard for step 3 before step 4: the bootstrap must not invent a
    // profile for a user that Supabase Auth has never seen.
    await expectRejects(db, bootstrapSql, /Auth user does not exist/);
  });

  it("grants a working administrator through the rendered bootstrap", async () => {
    await db.exec(`INSERT INTO auth.users (id) VALUES ('${ADMIN_USER_ID}'::uuid)`);

    await db.exec(bootstrapSql);

    expect(await scalar(
      db,
      "SELECT role FROM public.center_memberships WHERE profile_id = $1 AND center_id = $2",
      [ADMIN_USER_ID, CANONICAL_CENTER_ID],
    )).toBe("ADMIN");

    expect(await scalar(db, "SELECT full_name FROM public.profiles WHERE id = $1", [ADMIN_USER_ID]))
      .toBe("Salon Owner");

    expect(await scalar(
      db,
      "SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = $1",
      [ADMIN_USER_ID],
    )).toBe("ADMIN");
  });

  it("is safe to re-run after a partially failed launch", async () => {
    await db.exec(bootstrapSql);


    expect(await scalar(
      db,
      "SELECT count(*)::int FROM public.center_memberships WHERE profile_id = $1",
      [ADMIN_USER_ID],
    )).toBe(1);
  });

  it("produces an administrator the app's authorization boundary actually accepts", async () => {
    // Simulate the signed-in JWT that PostgREST would present.
    await db.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${ADMIN_USER_ID}'::uuid $$`);

    expect(await scalar(db, "SELECT app_private.has_center_role($1::uuid, ARRAY['ADMIN'])", [CANONICAL_CENTER_ID]))
      .toBe(true);
    // ADMIN passes the admin gate but not a role it does not hold.
    expect(await scalar(db, "SELECT app_private.has_center_role($1::uuid, ARRAY['STAFF'])", [CANONICAL_CENTER_ID]))
      .toBe(false);
    // A center the user is not a member of is denied outright.
    expect(await scalar(db, "SELECT app_private.has_center_role($1::uuid, ARRAY['ADMIN'])", [OTHER_CENTER_ID]))
      .toBe(false);
  });

  it("exposes the membership through the tenant helpers RLS policies rely on", async () => {
    const ids = await db.query("SELECT app_private.user_center_ids() AS ids");
    expect(ids.rows[0].ids).toContain(CANONICAL_CENTER_ID);
    expect(ids.rows[0].ids).not.toContain(OTHER_CENTER_ID);
  });

  it("keeps the first customer admin able to read their own center through RLS", async () => {
    // The authenticated role is what the browser actually connects as. Reading
    // the center name is the first query the dashboard makes after login.
    await db.exec("SET ROLE authenticated");

    try {
      expect(await scalar(db, "SELECT name FROM public.centers WHERE id = $1", [CANONICAL_CENTER_ID]))
        .toBeTruthy();
    } finally {
      await db.exec("RESET ROLE");
    }
  });
});

import { discoverMigrations, automatedMigrations, compatPreamble, translateMigration } from "../../../scripts/audit/lib/sql.mjs";
// @ts-ignore — PGlite ships its own types; relaxed here for the WASM import
import { PGlite } from "@electric-sql/pglite";

/**
 * Shared harness for the DATABASE BOUNDARY tests.
 *
 * `launch-rehearsal.test.mjs` proves one customer can be provisioned and that
 * the resulting administrator works. These tests prove the other half of the
 * same boundary:

 *   - `rls-isolation.test.mjs`      — two centers, two owners, one outsider, and
 *                                     the `anon` role, all reading through the
 *                                     real policies;
 *   - `public-booking-anon.test.mjs` — what the anonymous public surface is
 *                                     allowed to reach, and what it is not.
 *
 * Both need the same expensive setup (a fresh database with all 46 migrations
 * applied) and both need to act as several different signed-in users, so the
 * database construction and the actor switching live here.
 */

/** The center migration 1 seeds, and the one the app wires via VITE_CENTER_ID. */
export const CANONICAL_CENTER_ID = "7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d";
/** A second tenant. Never seeded by a migration: the test creates it. */
export const SECOND_CENTER_ID = "11111111-2222-3333-4444-555555555555";

export const OWNER_A_USER_ID = "9f1c7a54-6b2e-4d3f-8a11-2c5e7b9d4f60";
export const OWNER_B_USER_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
/** A real Auth user with no membership anywhere: the isolation canary. */
export const NON_MEMBER_USER_ID = "5e4d3c2b-1a09-4876-8b5a-4c3d2e1f0a9b";

export const TENANT_TABLES = [
  "customers",
  "services",
  "products",
  "employees",
  "appointments",
  "invoices",
];

function hasExplicitTransaction(sql) {
  return /^\s*BEGIN\s*;/m.test(sql) && /^\s*COMMIT\s*;/m.test(sql);
}

/**
 * Replays the canonical chain the way the shipped audit harness does: per-file
 * transaction with rollback on failure, so one broken migration cannot hide the
 * rest. Returns the failures instead of throwing, so a caller can assert on the
 * exact list.
 */
export async function replayAutomatedMigrations(db) {
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
 * A fresh database with the compatibility shim and every automated migration
 * applied — the same starting point the provisioner produces for a customer.
 */
export async function createBoundaryDatabase() {
  const db = new PGlite();
  for (const statement of compatPreamble()) await db.exec(statement);

  // The shim only models auth.users(id, raw_user_meta_data); real Supabase Auth
  // also has raw_app_meta_data, which the app reads the role from.
  await db.exec("ALTER TABLE auth.users ADD COLUMN raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb");

  const failures = await replayAutomatedMigrations(db);
  await installJwtClaimsAuthUid(db);
  return { db, failures };
}

/**
 * Replaces the shim's constant `auth.uid()` with the real Supabase definition,
 * which reads the JWT claims PostgREST puts on the request. That is what lets
 * one test file act as several different users in sequence — and it is the same
 * function every RLS policy in the chain resolves through.
 */
export async function installJwtClaimsAuthUid(db) {
  await db.exec(`
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
      SELECT COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      )::uuid
    $$
  `);
}

/**
 * Signs the session in as `userId` (null signs out). Mirrors what PostgREST
 * does per request: the JWT claims are set on the connection, and every policy
 * that calls auth.uid() sees this user.
 */
export async function setActor(db, userId) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claims', $1, false)", [
    userId ? JSON.stringify({ sub: userId }) : "",
  ]);
}

const ASSUMABLE_ROLES = new Set(["anon", "authenticated"]);

/** Runs `run` with the given PostgREST role assumed, then restores the session. */
export async function asRole(db, role, run) {
  if (!ASSUMABLE_ROLES.has(role)) throw new Error(`refusing to assume unsupported role: ${role}`);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec("RESET ROLE");
  }
}

export async function scalar(db, sql, params) {
  const result = await db.query(sql, params);
  const row = result.rows[0];
  return row ? Object.values(row)[0] : undefined;
}

export async function rows(db, sql, params) {
  const result = await db.query(sql, params);
  return result.rows;
}

/** The exact column set a result exposes — used to catch accidental widening. */
export async function columnNames(db, sql, params) {
  const result = await db.query(sql, params);
  return (result.fields ?? []).map((field) => field.name).sort();
}

/**
 * Runs a statement that is expected to be refused, then clears the aborted
 * transaction the failure leaves behind. Returns the rejection message so a
 * test can assert on why it was refused, not merely that it was.
 */
export async function expectRefused(db, sql, params) {
  let message = "";
  try {
    await db.query(sql, params);
  } catch (error) {
    message = String(error?.message ?? error);
  }
  try {
    await db.exec("ROLLBACK");
  } catch {
    /* no open transaction */
  }
  if (!message) throw new Error(`expected the statement to be refused, but it succeeded:\n${sql}`);
  return message;
}

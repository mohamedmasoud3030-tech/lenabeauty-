import { describe, it, expect } from "vitest";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { discoverMigrations, automatedMigrations, compatPreamble, translateMigration } from "../../scripts/audit/lib/sql.mjs";
// @ts-ignore — PGlite ships its own types; relaxed here for the WASM import
import { PGlite } from "@electric-sql/pglite";

const KNOWN_NON_IDEMPOTENT: { file: string; policy: string }[] = [];

function hasExplicitTransaction(sql: string): boolean {
  return /^\s*BEGIN\s*;/m.test(sql) && /^\s*COMMIT\s*;/m.test(sql);
}

async function replayInto(db: PGlite) {
  for (const stmt of compatPreamble()) await db.exec(stmt);
  const failures: string[] = [];
  const nonIdem: string[] = [];
  for (const m of automatedMigrations(discoverMigrations())) {
    const { sql } = translateMigration(m.content);
    const wrapped = !hasExplicitTransaction(sql);
    if (wrapped) await db.exec("BEGIN");
    try {
      await db.exec(sql);
      if (wrapped) await db.exec("COMMIT");
    } catch (e: any) {
      try { await db.exec("ROLLBACK"); } catch { /* no tx */ }
      failures.push(`${m.file}: ${String(e?.message ?? e).split("\n")[0]}`);
    }
  }
  // idempotency pass
  for (const m of automatedMigrations(discoverMigrations())) {
    const { sql } = translateMigration(m.content);
    const wrapped = !hasExplicitTransaction(sql);
    if (wrapped) await db.exec("BEGIN");
    try {
      await db.exec(sql);
      if (wrapped) await db.exec("COMMIT");
    } catch (e: any) {
      try { await db.exec("ROLLBACK"); } catch { /* no tx */ }
      nonIdem.push(`${m.file}: ${String(e?.message ?? e).split("\n")[0]}`);
    }
  }
  return { failures, nonIdem };
}

async function functionSignatureSet(db: PGlite): Promise<string[]> {
  const r = await db.query(
    `SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public','app_private') AND p.prokind = 'f'
     ORDER BY sig`,
  );
  return r.rows.map((x) => (x as { sig: string }).sig);
}

/**
 * Integration test: the canonical migrations must replay deterministically
 * against PGlite (bare PostgreSQL), with exactly one documented manual
 * bootstrap excluded, and only the two *known* idempotency gaps may surface.
 */
describe("audit: deterministic migration replay (PGlite)", () => {
  it("replays 39 automated migrations; excludes 1 manual bootstrap with no idempotency gaps", async () => {
    const all = discoverMigrations();
    expect(all).toHaveLength(40);
    const automated = automatedMigrations(all);
    expect(automated).toHaveLength(39);

    const db = new PGlite();
    const { failures, nonIdem } = await replayInto(db);

    expect(failures).toEqual([]);
    expect(nonIdem).toHaveLength(KNOWN_NON_IDEMPOTENT.length);
    for (const k of KNOWN_NON_IDEMPOTENT) {
      const found = nonIdem.find((n) => n.startsWith(k.file));
      expect(found, `expected idempotency gap in ${k.file}`).toBeTruthy();
      expect(found).toContain(`policy "${k.policy}"`);
    }

    const r = await db.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    expect((r.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(30);

    // Executable acceptance for the attendance integrity migration.
    await db.exec(`
      INSERT INTO public.centers (id, name)
      VALUES ('10000000-0000-0000-0000-000000000001', 'Attendance Test');
      INSERT INTO public.employees (id, center_id, name)
      VALUES ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Employee');
      INSERT INTO public.attendance_records
        (center_id, employee_id, date, check_in_time, check_out_time, work_hours)
      VALUES
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-08-17', '09:00', '17:00', 8);
    `);
    await expect(db.exec(`
      INSERT INTO public.attendance_records
        (center_id, employee_id, date, check_in_time, check_out_time, work_hours)
      VALUES
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-08-17', '10:00', '18:00', 8);
    `)).rejects.toThrow();
    await expect(db.exec(`
      INSERT INTO public.attendance_records
        (center_id, employee_id, date, check_in_time, check_out_time, work_hours)
      VALUES
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-08-18', '17:00', '09:00', 0);
    `)).rejects.toThrow();
    await expect(db.exec(`
      INSERT INTO public.attendance_records
        (center_id, employee_id, date, work_hours)
      VALUES
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-08-19', -1);
    `)).rejects.toThrow();

    await db.close();
  }, 60_000);

  it("replay is deterministic: two fresh replays produce the same catalog signature", async () => {
    const dbA = new PGlite();
    const dbB = new PGlite();
    await replayInto(dbA);
    await replayInto(dbB);
    const sigA = await functionSignatureSet(dbA);
    const sigB = await functionSignatureSet(dbB);
    expect(sigA).toEqual(sigB);
    await dbA.close();
    await dbB.close();
  }, 120_000);
});

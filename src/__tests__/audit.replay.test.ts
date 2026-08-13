import { describe, it, expect } from "vitest";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { discoverMigrations, automatedMigrations, compatPreamble, translateMigration } from "../../scripts/audit/lib/sql.mjs";
// @ts-ignore — PGlite ships its own types; relaxed here for the WASM import
import { PGlite } from "@electric-sql/pglite";

/**
 * Integration test: the canonical migrations must replay deterministically
 * against PGlite (bare PostgreSQL), with exactly one documented manual
 * bootstrap excluded, and only the two *known* idempotency gaps may surface.
 */
describe("audit: deterministic migration replay (PGlite)", () => {
  it("replays 28 automated migrations; excludes 1 manual bootstrap; surfaces only known idempotency gaps", async () => {
    const all = discoverMigrations();
    expect(all).toHaveLength(29);

    const automated = automatedMigrations(all);
    expect(automated).toHaveLength(28);

    const db = new PGlite();
    for (const stmt of compatPreamble()) {
      await db.exec(stmt);
    }

    // Replay pass.
    const failures = [];
    for (const m of automated) {
      const { sql } = translateMigration(m.content);
      try {
        await db.exec(sql);
      } catch (e: any) {
        failures.push({ file: m.file, error: String(e?.message ?? e).split("\n")[0] });
        try { await db.exec("ROLLBACK"); } catch { /* no tx */ }
      }
    }
    expect(failures).toEqual([]);

    // Idempotency pass.
    const nonIdempotent = [];
    for (const m of automated) {
      const { sql } = translateMigration(m.content);
      try {
        await db.exec(sql);
      } catch (e: any) {
        nonIdempotent.push({ file: m.file, error: String(e?.message ?? e).split("\n")[0] });
        try { await db.exec("ROLLBACK"); } catch { /* no tx */ }
      }
    }

    // The only expected idempotency gaps are two policies created without a
    // DROP POLICY IF EXISTS guard. Assert exactly those.
    const known = [
      { file: "20260628000012_customer_experience_forecasting_accounting_advanced.sql", policy: "customer_reviews_select_policy" },
      { file: "20260810000005_security_hardening_auth.sql", policy: "center_settings_insert" },
    ];
    expect(nonIdempotent).toHaveLength(known.length);
    for (const k of known) {
      const found = nonIdempotent.find((n) => n.file === k.file);
      expect(found, `expected idempotency gap in ${k.file}`).toBeTruthy();
      expect(found!.error).toContain(`policy "${k.policy}"`);
    }

    // Sanity: the replayed catalog has the expected core tables.
    const r = await db.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    expect((r.rows[0] as { n: number }).n).toBeGreaterThanOrEqual(30);

    await db.close();
  }, 60_000);
});

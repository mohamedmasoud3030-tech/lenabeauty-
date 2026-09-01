import { describe, it, expect } from "vitest";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { discoverMigrations, automatedMigrations, compatPreamble, translateMigration } from "../../scripts/audit/lib/sql.mjs";
// @ts-ignore — PGlite ships its own types; relaxed here for the WASM import
import { PGlite } from "@electric-sql/pglite";

const KNOWN_NON_IDEMPOTENT: { file: string; policy: string }[] = [];
const MANUAL_BOOTSTRAP = "20260628000002_admin_bootstrap.sql";

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
  // Idempotency pass: every automated migration must be safe to replay.
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
 * against PGlite (bare PostgreSQL). Exactly one documented manual bootstrap is
 * excluded; the contract deliberately does not hard-code the migration count,
 * so adding a canonical migration cannot be hidden behind a stale test number.
 */
describe("audit: deterministic migration replay (PGlite)", () => {
  it("replays every automated migration; excludes exactly one manual bootstrap with no idempotency gaps", async () => {
    const all = discoverMigrations();
    const automated = automatedMigrations(all);
    const automatedFiles = new Set(automated.map((migration) => migration.file));
    const excluded = all.filter((migration) => !automatedFiles.has(migration.file));

    expect(excluded.map((migration) => migration.file)).toEqual([MANUAL_BOOTSTRAP]);
    expect(automated).toHaveLength(all.length - 1);

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

    // Recipe writes are RPC-only for signed-in clients. This protects the
    // validation boundary from being bypassed by direct table mutations.
    const recipePrivileges = await db.query(`
      SELECT
        has_table_privilege('authenticated', 'public.service_recipes', 'SELECT') AS recipes_select,
        has_table_privilege('authenticated', 'public.service_recipes', 'INSERT') AS recipes_insert,
        has_table_privilege('authenticated', 'public.service_recipes', 'UPDATE') AS recipes_update,
        has_table_privilege('authenticated', 'public.service_recipe_items', 'SELECT') AS items_select,
        has_table_privilege('authenticated', 'public.service_recipe_items', 'INSERT') AS items_insert,
        has_table_privilege('authenticated', 'public.service_recipe_items', 'UPDATE') AS items_update,
        has_function_privilege(
          'authenticated',
          'app_private.consume_invoice_recipes_v1(uuid,uuid)',
          'EXECUTE'
        ) AS consumer_execute
    `);
    expect(recipePrivileges.rows[0]).toMatchObject({
      recipes_select: true,
      recipes_insert: false,
      recipes_update: false,
      items_select: true,
      items_insert: false,
      items_update: false,
      consumer_execute: false,
    });

    // Behavioral regression: duplicate invoice lines for one service must be
    // aggregated before recipe consumption. Otherwise the idempotency key
    // (invoice, service, product) would silently under-consume the second line.
    await db.exec(`
      INSERT INTO public.customers (id, center_id, name)
      VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Recipe Customer');

      INSERT INTO public.service_categories (id, center_id, name)
      VALUES ('35000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Recipe Test Category');

      INSERT INTO public.services (id, center_id, category_id, name, price, duration_minutes, is_active)
      VALUES (
        '40000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '35000000-0000-0000-0000-000000000001',
        'Recipe Service', 5.000, 30, true
      );

      INSERT INTO public.products (id, center_id, name, price, cost, stock_quantity, track_inventory, is_active)
      VALUES ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Consumable', 2.000, 1.000, 10, true, true);

      INSERT INTO public.invoices (
        id, center_id, customer_id, subtotal_amount, total_amount, amount_paid,
        payment_method, status
      )
      VALUES (
        '60000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000001',
        15.000, 15.000, 15.000, 'cash', 'PAID'
      );

      INSERT INTO public.invoice_items (invoice_id, service_id, price, quantity, item_type, item_name)
      VALUES
        ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 5.000, 1, 'service', 'Recipe Service'),
        ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 5.000, 2, 'service', 'Recipe Service');

      INSERT INTO public.service_recipes (id, center_id, service_id, is_active)
      VALUES ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', true);

      INSERT INTO public.service_recipe_items (center_id, recipe_id, product_id, quantity, unit, estimated_cost)
      VALUES ('10000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 1.000, 'unit', 1.000);

      SELECT app_private.consume_invoice_recipes_v1(
        '10000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001'
      );
    `);

    const consumption = await db.query(`
      SELECT quantity::numeric AS quantity
      FROM public.inventory_consumptions
      WHERE invoice_id = '60000000-0000-0000-0000-000000000001'
        AND service_id = '40000000-0000-0000-0000-000000000001'
        AND product_id = '50000000-0000-0000-0000-000000000001'
    `);
    expect(consumption.rows).toHaveLength(1);
    expect(Number((consumption.rows[0] as { quantity: number | string }).quantity)).toBe(3);

    const stockAfterFirst = await db.query(`
      SELECT stock_quantity FROM public.products
      WHERE id = '50000000-0000-0000-0000-000000000001'
    `);
    expect((stockAfterFirst.rows[0] as { stock_quantity: number }).stock_quantity).toBe(7);

    // A retry is idempotent: no second consumption row and no second decrement.
    await db.exec(`
      SELECT app_private.consume_invoice_recipes_v1(
        '10000000-0000-0000-0000-000000000001',
        '60000000-0000-0000-0000-000000000001'
      );
    `);
    const stockAfterRetry = await db.query(`
      SELECT stock_quantity FROM public.products
      WHERE id = '50000000-0000-0000-0000-000000000001'
    `);
    expect((stockAfterRetry.rows[0] as { stock_quantity: number }).stock_quantity).toBe(7);

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

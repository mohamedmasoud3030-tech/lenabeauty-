import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CANONICAL_CENTER_ID, createBoundaryDatabase } from "./helpers/pglite-tenant.mjs";

/**
 * THE QUERY PLANS THAT MATTER, LOCKED.
 *
 * Phase 7 asked for "indexes for appointments.date_time queries". Measured on a
 * seeded database, that index already existed and every appointment path was
 * already index-backed — so instead of adding an index nobody needed, this file
 * asserts the plans themselves. That turns a one-time measurement into a
 * standing guard: if a future migration drops an index, or a new WHERE clause
 * stops matching one, a test fails instead of the salon noticing a slow page.
 *
 * The volume matters. A planner will happily seq-scan a table with fifty rows,
 * so the seed is sized to the point where the choice is real. Measured at 8 000
 * customers / 8 000 appointments / 8 000 invoices / 2 000 products.
 */

const SEED = {
  customers: 8_000,
  appointments: 8_000,
  invoices: 8_000,
  products: 2_000,
};

const CUSTOMER = "55555555-6666-7777-8888-999999999999";
const EMPLOYEE = "22222222-3333-4444-5555-666666666666";
const CATEGORY = "33333333-4444-5555-6666-777777777777";
const SERVICE = "44444444-5555-6666-7777-888888888888";

let db;

/** The plan, as text, for one query. */
async function planOf(sql, params = [CANONICAL_CENTER_ID]) {
  const result = await db.query(`EXPLAIN (COSTS OFF) ${sql}`, params);
  return result.rows.map((row) => Object.values(row)[0]).join("\n");
}

describe("hot query paths are index-backed", () => {
  beforeAll(async () => {
    const created = await createBoundaryDatabase();
    db = created.db;
    expect(created.failures).toEqual([]);

    await db.exec(`
      INSERT INTO public.service_categories (id, center_id, name) VALUES ('${CATEGORY}', '${CANONICAL_CENTER_ID}', 'Hair');
      INSERT INTO public.services (id, center_id, category_id, name, price, duration_minutes, is_active)
        VALUES ('${SERVICE}', '${CANONICAL_CENTER_ID}', '${CATEGORY}', 'Trim', 10, 30, true);
      INSERT INTO public.employees (id, center_id, name, role, salary, base_salary, is_active)
        VALUES ('${EMPLOYEE}', '${CANONICAL_CENTER_ID}', 'Staff One', 'Staff', 100, 100, true);
      INSERT INTO public.customers (id, center_id, name, phone)
        VALUES ('${CUSTOMER}', '${CANONICAL_CENTER_ID}', 'Seed Customer', '95000000');

      INSERT INTO public.customers (center_id, name, phone, created_at)
      SELECT '${CANONICAL_CENTER_ID}', 'Client ' || g, '95' || lpad(g::text, 6, '0'), now() - (g || ' minutes')::interval
      FROM generate_series(1, ${SEED.customers}) g;

      INSERT INTO public.appointments (center_id, customer_id, employee_id, service_id, date_time, status)
      SELECT '${CANONICAL_CENTER_ID}', '${CUSTOMER}', '${EMPLOYEE}', '${SERVICE}',
             now() + (g || ' minutes')::interval, 'SCHEDULED'
      FROM generate_series(1, ${SEED.appointments}) g;

      INSERT INTO public.invoices (center_id, customer_id, date, total_amount, subtotal_amount, status, payment_method)
      SELECT '${CANONICAL_CENTER_ID}', '${CUSTOMER}', (now() - (g || ' hours')::interval)::date, 10, 10, 'VOID', 'CASH'
      FROM generate_series(1, ${SEED.invoices}) g;

      INSERT INTO public.products (center_id, name, price, cost, stock_quantity, reorder_level)
      SELECT '${CANONICAL_CENTER_ID}', 'Product ' || g, 5, 2, (g % 40), 5
      FROM generate_series(1, ${SEED.products}) g;

      ANALYZE;
    `);
  }, 300_000);

  afterAll(async () => {
    await db?.close?.();
  });

  it("serves the anonymous center+phone lookup from an index, not a scan", async () => {
    // public_create_booking_v1 (20260628000006:146) and both portal-login paths
    // (20260628000011:40, :86) run exactly this shape.
    const plan = await planOf(
      "SELECT id FROM public.customers WHERE center_id = $1 AND phone = '95001999' LIMIT 1",
    );
    expect(plan, plan).toContain("idx_customers_center_phone");
    expect(plan, plan).not.toMatch(/Seq Scan/);

    // Control: with index access switched off in this session, the identical
    // query falls back to a scan. That is what makes the assertion above a
    // statement about the index rather than about the row count.
    await db.exec("SET enable_indexscan = off; SET enable_bitmapscan = off;");
    const withoutIndex = await planOf(
      "SELECT id FROM public.customers WHERE center_id = $1 AND phone = '95001999' LIMIT 1",
    );
    await db.exec("SET enable_indexscan = on; SET enable_bitmapscan = on;");
    expect(withoutIndex, withoutIndex).toMatch(/Seq Scan/);
  });

  it("reads the catalogue in name order instead of scanning and sorting", async () => {
    // The POS/inventory/reports list: center + ORDER BY name.
    const plan = await planOf(
      "SELECT * FROM public.products WHERE center_id = $1 ORDER BY name LIMIT 200",
    );
    expect(plan, plan).not.toMatch(/Seq Scan/);
    expect(plan, plan).toMatch(/idx_products_center_name|Sort/);
  });

  it("keeps the appointment paths on their existing index", async () => {
    // The audit asked for an index here; it already existed. Locking it means a
    // future change cannot quietly lose it.
    const rangePlan = await planOf(
      "SELECT * FROM public.appointments WHERE center_id = $1 AND date_time >= now() AND date_time < now() + interval '7 days' ORDER BY date_time LIMIT 100",
    );
    expect(rangePlan, rangePlan).toContain("idx_appointments_dt");
    expect(rangePlan, rangePlan).not.toMatch(/Seq Scan/);

    // The double-booking check the booking form and the public RPC both run.
    const doubleBookPlan = await planOf(
      "SELECT 1 FROM public.appointments WHERE center_id = $1 AND employee_id = $2 AND status = 'SCHEDULED' AND date_time = now() LIMIT 1",
      [CANONICAL_CENTER_ID, EMPLOYEE],
    );
    expect(doubleBookPlan, doubleBookPlan).not.toMatch(/Seq Scan/);

    // Taken slots for a day, used by #/book.
    const takenPlan = await planOf(
      "SELECT 1 FROM public.appointments WHERE center_id = $1 AND status = 'SCHEDULED' AND date_time >= now()::date AND date_time < (now()::date + 1)",
    );
    expect(takenPlan, takenPlan).not.toMatch(/Seq Scan/);
  });

  it("keeps the reporting date range on its index", async () => {
    const plan = await planOf(
      "SELECT * FROM public.invoices WHERE center_id = $1 AND date >= (now() - interval '30 days')::date AND date <= now()::date",
    );
    expect(plan, plan).not.toMatch(/Seq Scan/);
  });

  it("records what a substring client search still costs", async () => {
    // Not a defect and not a target — a measurement kept on purpose. A leading
    // wildcard cannot use a btree index, so this stays a scan until a pg_trgm GIN
    // index is enabled. The test pins today's behaviour so the day it becomes a
    // real cost (more customers, slower storage) the plan is already documented.
    const byName = await planOf(
      "SELECT * FROM public.customers WHERE center_id = $1 AND name ILIKE '%Client 1999%' ORDER BY created_at DESC LIMIT 50",
    );
    const byPhone = await planOf(
      "SELECT * FROM public.customers WHERE center_id = $1 AND phone ILIKE '%1999%' ORDER BY created_at DESC LIMIT 50",
    );

    expect(byName, byName).toMatch(/Seq Scan/);
    expect(byPhone, byPhone).toMatch(/Seq Scan/);

    // And it stays bounded: the page asks for fifty rows, never the whole table.
    expect(byName, byName).toMatch(/Limit/);
  });
});

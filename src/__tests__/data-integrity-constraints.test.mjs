import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CANONICAL_CENTER_ID, createBoundaryDatabase, expectRefused, rows, scalar } from "./helpers/pglite-tenant.mjs";

/**
 * THE INVARIANTS THAT PROTECT THE SALON'S NUMBERS — proven, not assumed.
 *
 * The audit listed three data-integrity checks it could not confirm from the
 * outside ("PostgREST does not expose constraints"), and left them for a live
 * inspection. They are confirmable here instead: the same migration chain that
 * builds the live database is replayed, and each constraint is asked to refuse
 * the corruption it exists to prevent.
 *
 * A constraint that is present but never proven is a comment. These four are
 * the ones whose absence would quietly cost money: negative stock, an invoice
 * whose parts do not add up, an appointment with nobody to serve it, and two
 * clients sharing one portal token.
 */

let db;
let customerId;

describe("the database refuses corrupt stock, money and access records", () => {
  beforeAll(async () => {
    const created = await createBoundaryDatabase();
    db = created.db;
    expect(created.failures).toEqual([]);

    const categoryId = (
      await db.query(
        "INSERT INTO public.service_categories (center_id, name) VALUES ($1, 'Hair') RETURNING id",
        [CANONICAL_CENTER_ID],
      )
    ).rows[0].id;

    customerId = (
      await db.query(
        "INSERT INTO public.customers (center_id, name, phone, portal_access_enabled, portal_access_token) VALUES ($1, 'Portal Client', '91111111', TRUE, 'TOKEN-A') RETURNING id",
        [CANONICAL_CENTER_ID],
      )
    ).rows[0].id;

    db.__ids = { categoryId };
  }, 300_000);

  afterAll(async () => {
    await db?.close?.();
  });

  it("refuses negative stock (products_stock_non_negative)", async () => {
    const refused = await expectRefused(
      db,
      "INSERT INTO public.products (center_id, name, price, cost, stock_quantity) VALUES ($1, 'Bad Product', 5, 2, -1)",
      [CANONICAL_CENTER_ID],
    );
    expect(refused).toMatch(/products_stock_non_negative/);

    // The control: zero is allowed, so the constraint rejects the sign, not the value.
    const zero = await rows(
      db,
      "INSERT INTO public.products (center_id, name, price, cost, stock_quantity) VALUES ($1, 'Empty Product', 5, 2, 0) RETURNING stock_quantity",
      [CANONICAL_CENTER_ID],
    );
    expect(Number(zero[0].stock_quantity)).toBe(0);
  });

  it("refuses a PAID invoice whose parts do not add up (invoices_paid_totals_consistent)", async () => {
    // 100 − 0 discounts + 0 tax cannot total 50. amount_paid equals the (wrong)
    // total on purpose, so the only broken clause is the arithmetic itself.
    const refused = await expectRefused(
      db,
      `INSERT INTO public.invoices (center_id, customer_id, date, subtotal_amount, discount, tax, total_amount, amount_paid, status, payment_method, tax_rate)
       VALUES ($1, $2, now()::date, 100, 0, 0, 50, 50, 'PAID', 'CASH', 0)`,
      [CANONICAL_CENTER_ID, customerId],
    );
    expect(refused).toMatch(/invoices_paid_totals_consistent/);

    // The control: the same figures, consistent and fully paid, are accepted.
    const consistent = await rows(
      db,
      `INSERT INTO public.invoices (center_id, customer_id, date, subtotal_amount, discount, tax, total_amount, amount_paid, status, payment_method, tax_rate)
       VALUES ($1, $2, now()::date, 100, 0, 0, 100, 100, 'PAID', 'CASH', 0) RETURNING total_amount`,
      [CANONICAL_CENTER_ID, customerId],
    );
    expect(Number(consistent[0].total_amount)).toBe(100);

    // A PAID invoice that adds up but is not fully paid is refused as well: the
    // constraint is not only about the arithmetic.
    const underpaid = await expectRefused(
      db,
      `INSERT INTO public.invoices (center_id, customer_id, date, subtotal_amount, discount, tax, total_amount, amount_paid, status, payment_method, tax_rate)
       VALUES ($1, $2, now()::date, 100, 0, 0, 100, 40, 'PAID', 'CASH', 0)`,
      [CANONICAL_CENTER_ID, customerId],
    );
    expect(underpaid).toMatch(/invoices_paid_totals_consistent/);
  });

  it("refuses an appointment with nobody to serve it (appointment_customer_service_staff_time_required)", async () => {
    const refused = await expectRefused(
      db,
      "INSERT INTO public.appointments (center_id, customer_id, service_id, date_time, status) VALUES ($1, $2, NULL, now(), 'SCHEDULED')",
      [CANONICAL_CENTER_ID, customerId],
    );
    expect(refused).toMatch(/appointment_customer_service_staff_time_required/);
  });

  it("refuses two clients sharing one portal token (idx_customers_center_portal_token)", async () => {
    // A shared token is not a duplicate row: it is one client able to read and
    // cancel another client's appointments.
    const refused = await expectRefused(
      db,
      "INSERT INTO public.customers (center_id, name, phone, portal_access_enabled, portal_access_token) VALUES ($1, 'Impostor', '92222222', TRUE, 'TOKEN-A')",
      [CANONICAL_CENTER_ID],
    );
    expect(refused).toMatch(/idx_customers_center_portal_token|duplicate key/i);

    // And the rule is per salon, so the same token in another centre is fine.
    const otherCenter = "11111111-2222-3333-4444-555555555555";
    await db.query("INSERT INTO public.centers (id, name) VALUES ($1, 'Second Salon')", [otherCenter]);
    const allowed = await rows(
      db,
      "INSERT INTO public.customers (center_id, name, phone, portal_access_enabled, portal_access_token) VALUES ($1, 'Other Client', '93333333', TRUE, 'TOKEN-A') RETURNING id",
      [otherCenter],
    );
    expect(allowed.length).toBe(1);

    const tokens = await scalar(
      db,
      "SELECT count(*) FROM public.customers WHERE center_id = $1 AND portal_access_token IS NOT NULL",
      [CANONICAL_CENTER_ID],
    );
    expect(Number(tokens)).toBe(1);
  });
});

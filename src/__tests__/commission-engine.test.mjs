import { afterAll, beforeAll, describe, expect, it } from "vitest";
// @ts-ignore — plain-JS launch tooling shipped without type declarations
import { renderMembershipBootstrap } from "../../scripts/launch/render-membership-bootstrap.mjs";
import {
  CANONICAL_CENTER_ID,
  createBoundaryDatabase,
  expectRefused,
  rows,
  scalar,
  setActor,
} from "./helpers/pglite-tenant.mjs";

/**
 * THE COMMISSION ENGINE — executed, not read.
 *
 * `supabase.commission-engine-migration.test.ts` asserts the TEXT of
 * `20260912100000_commission_engine.sql`. Nothing ran it. That is exactly how
 * the live project ended up serving `42703 column payroll_line_items.
 * commission_amount does not exist`: the migration is unapplied there, and no
 * test could tell the difference between "the SQL looks right" and "the
 * database does what the product promises".
 *
 * This file provisions a database, records real paid invoices and an approved
 * advance, then runs the payroll RPC the Payroll screen runs — asserting the
 * numbers an accountant would check by hand:
 *
 *   commission = round(earned revenue × commission_percentage / 100)
 *   net        = greatest(base_salary + commission − advances, 0)
 *
 * It also executes the migration's central promise — payroll and the dashboard
 * cannot disagree — by comparing the run's lines against get_dashboard_pnl_v1
 * for the same period.
 */

const ADMIN_USER_ID = "b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const STAFF_USER_ID = "c2b3a4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d";
const PERIOD = "2026-09";

/** Invoices are seeded through one helper so the PAID constraint is met once. */
const PAID = (centerId, customerId, employeeId, amount, isoDate) => [
  `INSERT INTO public.invoices
     (center_id, customer_id, employee_id, status, subtotal_amount, total_amount,
      amount_paid, tax_rate, tax, discount, date)
   VALUES ($1, $2, $3, 'PAID', $4, $4, $4, 0, 0, 0, $5::timestamptz)`,
  [centerId, customerId, employeeId, amount, isoDate],
];

describe("the commission engine pays what it promises", () => {
  let db;
  const id = {};

  beforeAll(async () => {
    const created = await createBoundaryDatabase();
    db = created.db;
    expect(created.failures).toEqual([]);

    for (const userId of [ADMIN_USER_ID, STAFF_USER_ID]) {
      await db.query("INSERT INTO auth.users (id) VALUES ($1::uuid)", [userId]);
    }
    await db.exec(renderMembershipBootstrap({
      userId: ADMIN_USER_ID,
      centerId: CANONICAL_CENTER_ID,
      role: "ADMIN",
      fullName: "Salon Owner",
    }));
    await db.exec(renderMembershipBootstrap({
      userId: STAFF_USER_ID,
      centerId: CANONICAL_CENTER_ID,
      role: "STAFF",
      fullName: "Receptionist",
    }));

    const category = await db.query(
      "INSERT INTO public.service_categories (center_id, name) VALUES ($1, 'Hair') RETURNING id",
      [CANONICAL_CENTER_ID],
    );
    id.category = category.rows[0].id;

    const employee = async (name, base, percentage, isActive) => (await db.query(
      "INSERT INTO public.employees (center_id, name, role, salary, base_salary, commission_percentage, is_active) VALUES ($1,$2,'Staff',$3,$3,$4,$5) RETURNING id",
      [CANONICAL_CENTER_ID, name, base, percentage, isActive],
    )).rows[0].id;

    id.stylist = await employee("Stylist", 200, 10, true);
    id.assistant = await employee("Assistant", 100, 5, true);
    id.former = await employee("Former", 300, 50, false);

    id.customer = (await db.query(
      "INSERT INTO public.customers (center_id, name) VALUES ($1, 'Client') RETURNING id",
      [CANONICAL_CENTER_ID],
    )).rows[0].id;

    // Earned revenue in the period, attributed to the employee who checked out.
    await db.query(...PAID(CANONICAL_CENTER_ID, id.customer, id.stylist, 1000, "2026-09-05T10:00:00+00:00"));
    await db.query(...PAID(CANONICAL_CENTER_ID, id.customer, id.stylist, 500, "2026-09-20T10:00:00+00:00"));
    await db.query(...PAID(CANONICAL_CENTER_ID, id.customer, id.assistant, 200, "2026-09-21T10:00:00+00:00"));
    // A different month, and a voided invoice: neither is earned revenue now.
    await db.query(...PAID(CANONICAL_CENTER_ID, id.customer, id.stylist, 9000, "2026-08-31T10:00:00+00:00"));
    await db.query(
      "INSERT INTO public.invoices (center_id, customer_id, employee_id, status, subtotal_amount, total_amount, tax_rate, date) VALUES ($1,$2,$3,'VOID',7000,7000,0,'2026-09-10T10:00:00+00:00')",
      [CANONICAL_CENTER_ID, id.customer, id.stylist],
    );
    // A paid invoice with no employee attributed earns nobody a commission.
    await db.query(
      "INSERT INTO public.invoices (center_id, customer_id, status, subtotal_amount, total_amount, amount_paid, tax_rate, date) VALUES ($1,$2,'PAID',400,400,400,0,'2026-09-11T10:00:00+00:00')",
      [CANONICAL_CENTER_ID, id.customer],
    );

    await db.query(
      "INSERT INTO public.employee_advances (center_id, employee_id, amount, status, advance_date) VALUES ($1,$2,50,'APPROVED','2026-09-12T10:00:00+00:00')",
      [CANONICAL_CENTER_ID, id.stylist],
    );
  }, 180_000);

  afterAll(async () => {
    await db?.close?.();
  });

  const runPayroll = async () => {
    await setActor(db, ADMIN_USER_ID);
    const result = await rows(
      db,
      "SELECT public.create_payroll_run_v1($1::uuid, $2, NULL) AS run",
      [CANONICAL_CENTER_ID, PERIOD],
    );
    return result[0].run;
  };

  it("computes commission from paid revenue and pays base + commission − advances", async () => {
    const run = await runPayroll();

    const lines = new Map(run.lines.map((line) => [line.employee_id, line]));
    // Stylist: 1000 + 500 = 1500 earned × 10% = 150. Base 200 − advance 50.
    expect(Number(lines.get(id.stylist).commission_amount)).toBe(150);
    expect(Number(lines.get(id.stylist).base_salary)).toBe(200);
    expect(Number(lines.get(id.stylist).advances_deducted)).toBe(50);
    expect(Number(lines.get(id.stylist).net_salary)).toBe(300);
    // Assistant: 200 × 5% = 10.
    expect(Number(lines.get(id.assistant).commission_amount)).toBe(10);
    expect(Number(lines.get(id.assistant).net_salary)).toBe(110);
    // The disabled employee is not paid at all.
    expect(lines.has(id.former)).toBe(false);
    expect(run.lines).toHaveLength(2);
  });

  it("snapshots the commission so a later percentage change cannot rewrite history", async () => {
    await db.query("UPDATE public.employees SET commission_percentage = 50 WHERE id = $1", [id.stylist]);

    const stored = await scalar(
      db,
      "SELECT commission_amount FROM public.payroll_line_items WHERE employee_id = $1",
      [id.stylist],
    );
    expect(Number(stored)).toBe(150);
  });

  it("marks the advances it deducted so they cannot be paid twice", async () => {
    const advance = await rows(
      db,
      "SELECT status, deducted_in_run_id FROM public.employee_advances WHERE employee_id = $1",
      [id.stylist],
    );
    expect(advance[0].status).toBe("DEDUCTED");
    expect(advance[0].deducted_in_run_id).toBeTruthy();
  });

  it("refuses a second run for the same period", async () => {
    await setActor(db, ADMIN_USER_ID);
    const message = await expectRefused(
      db,
      "SELECT public.create_payroll_run_v1($1::uuid, $2, NULL)",
      [CANONICAL_CENTER_ID, PERIOD],
    );
    expect(message).toMatch(/payroll_period_already_exists/);
  });

  it("agrees with the dashboard, which is the whole point of deriving both", async () => {
    // Restore the contracted percentage the period was run under.
    await db.query("UPDATE public.employees SET commission_percentage = 10 WHERE id = $1", [id.stylist]);
    await setActor(db, ADMIN_USER_ID);

    const pnl = await rows(
      db,
      "SELECT public.get_dashboard_pnl_v1($1::uuid, $2::timestamptz, $3::timestamptz) AS pnl",
      [CANONICAL_CENTER_ID, "2026-09-01T00:00:00+00:00", "2026-10-01T00:00:00+00:00"],
    );
    const runCommission = await scalar(
      db,
      "SELECT sum(commission_amount) FROM public.payroll_line_items WHERE center_id = $1",
      [CANONICAL_CENTER_ID],
    );

    expect(Number(pnl[0].pnl.commissions)).toBe(160); // 150 + 10
    expect(Number(runCommission)).toBe(160);
    // Revenue belongs to the salon, commission belongs to the employee: every
    // paid invoice in the window counts (1000 + 500 + 200 + 400), while only the
    // attributed ones earn anybody a commission.
    expect(Number(pnl[0].pnl.revenue)).toBe(2100);
  });

  it("keeps the admin-only door closed for staff", async () => {
    await setActor(db, STAFF_USER_ID);
    const message = await expectRefused(
      db,
      "SELECT public.create_payroll_run_v1($1::uuid, $2, NULL)",
      [CANONICAL_CENTER_ID, "2026-10"],
    );
    expect(message).toMatch(/admin_role_required/);
  });
});

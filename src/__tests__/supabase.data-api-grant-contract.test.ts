/**
 * Executable authorization regression suite for the Data API grant contract.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAuthorizationHarness, asRole, tablePrivileges, FIXTURES } from "../../scripts/audit/lib/rls-harness.mjs";
import type { HarnessDatabase, RoleResult } from "../../scripts/audit/lib/rls-harness.mjs";

function expectRows<T>(result: RoleResult<T>, context: string): T[] {
  expect(result.outcome, `${context}: ${result.message ?? ""}`).toBe("ok");
  return (result as { outcome: "ok"; rows: T[] }).rows;
}

let db: HarnessDatabase;

beforeAll(async () => {
  const harness = await createAuthorizationHarness();
  expect(harness.failures, "canonical migration chain replays cleanly").toEqual([]);
  db = harness.db;
}, 120_000);

afterAll(async () => {
  if (db) await db.close();
});

const READ_SURFACE = [
  "customers", "appointments", "services", "products", "expenses",
  "attendance_records", "employee_advances", "center_settings", "employees",
  "invoices", "invoice_items", "payments", "payroll_runs", "payroll_line_items",
  "gift_cards", "gift_card_transactions", "service_packages", "service_files",
  "customer_reviews", "accounting_journal_entries", "ai_booking_leads",
  "notification_settings", "payment_gateway_settings", "service_categories",
  "customer_entitlements", "entitlement_ledger", "package_entitlement_units",
  "center_memberships", "centers", "profiles",
];

describe("Data API grant contract — login", () => {
  it("resolves the signed-in user's membership", async () => {
    const result = await asRole<{ center_id: string; role: string; name: string }>(
      db, { uid: FIXTURES.adminA }, `
      SELECT m.center_id, m.role, c.name
        FROM public.center_memberships m
        JOIN public.centers c ON c.id = m.center_id
    `);
    const rows = expectRows(result, "login membership query");
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("ADMIN");
  });

  it("isolates memberships and centers by user", async () => {
    const memberships = await asRole<{ center_id: string }>(db, { uid: FIXTURES.adminB },
      "SELECT center_id FROM public.center_memberships");
    expect(expectRows(memberships, "own memberships").map((r) => r.center_id))
      .toEqual([FIXTURES.centerB]);

    const centers = await asRole<{ id: string }>(db, { uid: FIXTURES.adminB },
      "SELECT id FROM public.centers");
    expect(expectRows(centers, "own centers").map((r) => r.id)).toEqual([FIXTURES.centerB]);
  });

  it("returns an empty membership set for an outsider", async () => {
    const result = await asRole(db, { uid: FIXTURES.outsider },
      "SELECT center_id FROM public.center_memberships");
    expect(expectRows(result, "outsider memberships")).toEqual([]);
  });
});

describe("Data API grant contract — operational surface", () => {
  it.each(READ_SURFACE)("grants authenticated SELECT on %s", async (table) => {
    const result = await asRole(db, { uid: FIXTURES.adminA },
      `SELECT count(*)::int AS n FROM public.${table}`);
    expect(result.outcome, `${table}: ${result.message ?? ""}`).toBe("ok");
  });

  it("allows the direct operational writes the UI uses", async () => {
    const writes: [string, string][] = [
      ["customers.create", `INSERT INTO public.customers(center_id, name, phone) VALUES ('${FIXTURES.centerA}', 'New', '90000009')`],
      ["customers.update", `UPDATE public.customers SET name = 'Renamed' WHERE id = '${FIXTURES.customerA}'`],
      ["expenses.create", `INSERT INTO public.expenses(center_id, description, amount, category) VALUES ('${FIXTURES.centerA}', 'Rent', 10, 'Fixed')`],
      ["attendance.create", `INSERT INTO public.attendance_records(center_id, employee_id, date) VALUES ('${FIXTURES.centerA}', '${FIXTURES.employeeA}', CURRENT_DATE)`],
      ["advances.create", `INSERT INTO public.employee_advances(center_id, employee_id, amount) VALUES ('${FIXTURES.centerA}', '${FIXTURES.employeeA}', 25)`],
      ["settings.update", `UPDATE public.center_settings SET name = 'Lena' WHERE center_id = '${FIXTURES.centerA}'`],
      ["categories.upsert", `INSERT INTO public.service_categories(center_id, name) VALUES ('${FIXTURES.centerA}', 'Hair') ON CONFLICT (center_id, name) DO UPDATE SET name = EXCLUDED.name`],
    ];
    for (const [label, sql] of writes) {
      const result = await asRole(db, { uid: FIXTURES.adminA }, sql);
      expect(result.outcome, `${label}: ${result.message ?? ""}`).toBe("ok");
    }
  });
});

describe("Data API grant contract — tenant isolation", () => {
  it("returns no cross-tenant rows", async () => {
    const read = await asRole<{ n: number }>(db, { uid: FIXTURES.adminA },
      `SELECT count(*)::int AS n FROM public.customers WHERE center_id = '${FIXTURES.centerB}'`);
    expect(expectRows(read, "cross-tenant read")[0].n).toBe(0);
  });

  it("refuses cross-tenant writes", async () => {
    const write = await asRole(db, { uid: FIXTURES.adminA },
      `INSERT INTO public.customers(center_id, name, phone) VALUES ('${FIXTURES.centerB}', 'Injected', '90000010')`);
    expect(write.outcome).not.toBe("ok");
    expect(write.message).toMatch(/row-level security|permission denied/i);
  });

  it("does not trust a client-supplied profile id", async () => {
    const result = await asRole<{ n: number }>(db, { uid: FIXTURES.adminB },
      `SELECT count(*)::int AS n FROM public.center_memberships WHERE profile_id = '${FIXTURES.adminA}'`);
    expect(expectRows(result, "spoofed profile_id")[0].n).toBe(0);
  });
});

describe("Data API grant contract — escalation and containment", () => {
  it("blocks STAFF from granting itself ADMIN", async () => {
    const escalate = await asRole(db, { uid: FIXTURES.staffA },
      "UPDATE public.center_memberships SET role = 'ADMIN' WHERE profile_id = auth.uid()");
    expect(escalate.outcome).not.toBe("ok");
    const after = await db.query("SELECT role FROM public.center_memberships WHERE profile_id = $1", [FIXTURES.staffA]);
    expect(after.rows[0].role).toBe("STAFF");
  });

  it("blocks joining another center", async () => {
    const join = await asRole(db, { uid: FIXTURES.staffA },
      `INSERT INTO public.center_memberships(profile_id, center_id, role) VALUES (auth.uid(), '${FIXTURES.centerB}', 'ADMIN')`);
    expect(join.outcome).not.toBe("ok");
  });

  it("keeps ADMIN-only rows empty for STAFF", async () => {
    for (const table of ["expenses", "attendance_records", "employee_advances"]) {
      const result = await asRole<{ n: number }>(db, { uid: FIXTURES.staffA },
        `SELECT count(*)::int AS n FROM public.${table}`);
      expect(expectRows(result, table)[0].n).toBe(0);
    }
  });

  it("never exposes employee compensation through the Data API", async () => {
    for (const column of ["salary", "base_salary", "commission_percentage"]) {
      const result = await asRole(db, { uid: FIXTURES.adminA }, `SELECT ${column} FROM public.employees`);
      expect(result.outcome).toBe("denied");
    }
    const safe = await asRole(db, { uid: FIXTURES.adminA },
      "SELECT id, name, role, is_active FROM public.employees");
    expect(safe.outcome).toBe("ok");
  });

  it("routes employee mutations through RPCs", async () => {
    const direct = await asRole(db, { uid: FIXTURES.adminA },
      "UPDATE public.employees SET name = 'Direct' WHERE center_id = auth.uid()");
    expect(direct.outcome).toBe("denied");
  });

  it("forbids direct writes to financial records", async () => {
    const financial = [
      ["invoices", `INSERT INTO public.invoices(center_id, total_amount) VALUES ('${FIXTURES.centerA}', 100)`],
      ["payments", `INSERT INTO public.payments(center_id, amount) VALUES ('${FIXTURES.centerA}', 100)`],
      ["gift_cards", "UPDATE public.gift_cards SET current_balance = 999"],
      ["entitlement_ledger", "DELETE FROM public.entitlement_ledger"],
      ["payroll_runs", `INSERT INTO public.payroll_runs(center_id, period_month) VALUES ('${FIXTURES.centerA}', '2026-08')`],
    ];
    for (const [label, sql] of financial) {
      const result = await asRole(db, { uid: FIXTURES.adminA }, sql);
      expect(result.outcome, `${label} must not be directly writable`).toBe("denied");
    }
  });

  it("forbids hard deletion of retained master records", async () => {
    for (const table of [
      "customers", "services", "products", "appointments",
      "expenses", "attendance_records", "employee_advances", "center_settings",
    ]) {
      const result = await asRole(db, { uid: FIXTURES.adminA }, `DELETE FROM public.${table}`);
      expect(result.outcome, `${table} DELETE must be revoked`).toBe("denied");
    }
  });

  it("keeps the checkout idempotency ledger private", async () => {
    const result = await asRole(db, { uid: FIXTURES.adminA },
      "SELECT count(*) FROM public.checkout_idempotency");
    expect(result.outcome).toBe("denied");
  });
});

describe("Data API grant contract — anon and future objects", () => {
  it.each(READ_SURFACE)("denies anon every privilege on %s", async (table) => {
    expect(await tablePrivileges(db, table, "anon")).toEqual([]);
  });

  it("denies unauthenticated reads", async () => {
    for (const table of ["customers", "invoices", "employees", "centers", "center_memberships"]) {
      const result = await asRole(db, { role: "anon", uid: null }, `SELECT count(*) FROM public.${table}`);
      expect(result.outcome).toBe("denied");
    }
  });

  it("does not auto-expose a future table", async () => {
    await db.exec("CREATE TABLE IF NOT EXISTS public.contract_probe_tmp (id int primary key)");
    try {
      expect(await tablePrivileges(db, "contract_probe_tmp", "anon")).toEqual([]);
      expect(await tablePrivileges(db, "contract_probe_tmp", "authenticated")).toEqual([]);
    } finally {
      await db.exec("DROP TABLE IF EXISTS public.contract_probe_tmp");
    }
  });
});

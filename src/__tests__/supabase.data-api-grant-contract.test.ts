/**
 * Executable authorization regression suite.
 *
 * Every other `supabase.*.test.ts` in this repository asserts on migration TEXT.
 * That class of test cannot detect the defect this suite exists to prevent:
 * privileges the application silently INHERITED from Supabase's legacy
 * "auto-expose new tables in the public schema" behaviour, which was never
 * written into the migration chain and which Supabase enforces away on
 * 2026-10-30.
 *
 * So this suite executes instead of asserting. It replays the canonical chain
 * into a bare PostgreSQL (PGlite — no Supabase default privileges whatsoever),
 * then runs real statements under `SET ROLE authenticated` with a real
 * `auth.uid()`. A passing run is evidence the application works on a freshly
 * provisioned Supabase project, not merely on the grandfathered Demo project.
 *
 * It deliberately covers BOTH layers of PostgreSQL authorization, because they
 * fail differently and mean different things:
 *   - a missing GRANT   => 42501 "permission denied for table ..." (page breaks)
 *   - a missing//narrow policy => 0 rows (page silently renders empty)
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createAuthorizationHarness, asRole, tablePrivileges, FIXTURES } from "../../scripts/audit/lib/rls-harness.mjs";
import type { HarnessDatabase, RoleResult } from "../../scripts/audit/lib/rls-harness.mjs";

/**
 * Assert a statement ran, then narrow to its rows. Failing here means the role
 * lacked a GRANT (or hit an unexpected error), which is exactly the class of
 * defect this suite guards against — so the message carries the SQL error.
 */
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

/** Tables the staff UI reads directly through PostgREST. */
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

describe("Data API grant contract — the login journey", () => {
  it("resolves center membership, which is the gate for the entire app", async () => {
    // AppContext.applySessionState() calls getMyCenters() first. If this query
    // is denied, a fully valid ADMIN is bounced to Login with
    // UNAUTHORIZED_CENTER_MEMBERSHIP and no page ever renders.
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

  it("shows a user only their own membership and center rows", async () => {
    const memberships = await asRole<{ center_id: string }>(db, { uid: FIXTURES.adminB },
      "SELECT center_id FROM public.center_memberships");
    expect(expectRows(memberships, "own memberships").map((r) => r.center_id))
      .toEqual([FIXTURES.centerB]);

    const centers = await asRole<{ id: string }>(db, { uid: FIXTURES.adminB },
      "SELECT id FROM public.centers");
    expect(expectRows(centers, "own centers").map((r) => r.id)).toEqual([FIXTURES.centerB]);
  });

  it("gives a user with no membership an empty, non-crashing session", async () => {
    const result = await asRole(db, { uid: FIXTURES.outsider },
      "SELECT center_id FROM public.center_memberships");
    expect(expectRows(result, "outsider memberships")).toEqual([]);
  });
});

describe("Data API grant contract — operational pages are reachable", () => {
  it.each(READ_SURFACE)("grants an authenticated SELECT path on %s", async (table) => {
    const result = await asRole(db, { uid: FIXTURES.adminA },
      `SELECT count(*)::int AS n FROM public.${table}`);
    expect(result.outcome, `${table}: ${result.message ?? ""}`).toBe("ok");
  });

  it("allows the direct writes the staff UI actually performs", async () => {
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
  it("returns no cross-tenant rows even though the grant exists", async () => {
    // The GRANT lets PostgREST consider the table; RLS decides the rows. Center
    // B's data must be invisible to a Center A admin.
    const read = await asRole<{ n: number }>(db, { uid: FIXTURES.adminA },
      `SELECT count(*)::int AS n FROM public.customers WHERE center_id = '${FIXTURES.centerB}'`);
    expect(expectRows(read, "cross-tenant read")[0].n).toBe(0);
  });

  it("refuses a write aimed at another tenant", async () => {
    const write = await asRole(db, { uid: FIXTURES.adminA },
      `INSERT INTO public.customers(center_id, name, phone) VALUES ('${FIXTURES.centerB}', 'Injected', '90000010')`);
    expect(write.outcome).not.toBe("ok");
    expect(write.message).toMatch(/row-level security|permission denied/i);
  });

  it("ignores a client-supplied identity and trusts only auth.uid()", async () => {
    // Passing another user's id as data must not widen visibility.
    const result = await asRole<{ n: number }>(db, { uid: FIXTURES.adminB },
      `SELECT count(*)::int AS n FROM public.center_memberships WHERE profile_id = '${FIXTURES.adminA}'`);
    expect(expectRows(result, "spoofed profile_id")[0].n).toBe(0);
  });
});

describe("Data API grant contract — privilege escalation is impossible", () => {
  it("blocks a STAFF user from granting themselves ADMIN", async () => {
    const escalate = await asRole(db, { uid: FIXTURES.staffA },
      "UPDATE public.center_memberships SET role = 'ADMIN' WHERE profile_id = auth.uid()");
    expect(escalate.outcome).not.toBe("ok");

    const after = await db.query(
      "SELECT role FROM public.center_memberships WHERE profile_id = $1", [FIXTURES.staffA]);
    expect(after.rows[0].role).toBe("STAFF");
  });

  it("blocks a user from joining a center they do not belong to", async () => {
    const join = await asRole(db, { uid: FIXTURES.staffA },
      `INSERT INTO public.center_memberships(profile_id, center_id, role) VALUES (auth.uid(), '${FIXTURES.centerB}', 'ADMIN')`);
    expect(join.outcome).not.toBe("ok");
  });

  it("keeps ADMIN-only rows invisible to STAFF without breaking the page", async () => {
    // STAFF must get an empty result, never an error: the page renders its
    // normal empty state rather than a crash.
    for (const table of ["expenses", "attendance_records", "employee_advances"]) {
      const result = await asRole<{ n: number }>(db, { uid: FIXTURES.staffA },
        `SELECT count(*)::int AS n FROM public.${table}`);
      expect(expectRows(result, table)[0].n, `${table} must be empty for STAFF`).toBe(0);
    }
  });
});

describe("Data API grant contract — containment boundaries hold", () => {
  it("never exposes employee compensation through the Data API", async () => {
    for (const column of ["salary", "base_salary", "commission_percentage"]) {
      const result = await asRole(db, { uid: FIXTURES.adminA },
        `SELECT ${column} FROM public.employees`);
      expect(result.outcome, `${column} must not be selectable`).toBe("denied");
    }
    // The safe columns remain readable so relationship embeds keep working.
    const safe = await asRole(db, { uid: FIXTURES.adminA },
      "SELECT id, name, role, is_active FROM public.employees");
    expect(safe.outcome).toBe("ok");
  });

  it("routes every employee mutation through the admin RPCs", async () => {
    const direct = await asRole(db, { uid: FIXTURES.adminA },
      "UPDATE public.employees SET name = 'Direct' WHERE center_id = auth.uid()");
    expect(direct.outcome).toBe("denied");
  });

  it("forbids direct writes to financial records", async () => {
    const financial = [
      ["invoices", `INSERT INTO public.invoices(center_id, total_amount) VALUES ('${FIXTURES.centerA}', 100)`],
      ["payments", `INSERT INTO public.payments(center_id, amount) VALUES ('${FIXTURES.centerA}', 100)`],
      ["gift_cards", `UPDATE public.gift_cards SET current_balance = 999`],
      ["entitlement_ledger", `DELETE FROM public.entitlement_ledger`],
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

  it("keeps the checkout idempotency ledger private to its RPC", async () => {
    const result = await asRole(db, { uid: FIXTURES.adminA },
      "SELECT count(*) FROM public.checkout_idempotency");
    expect(result.outcome).toBe("denied");
  });
});

describe("Data API grant contract — anon has no surface", () => {
  it.each(READ_SURFACE)("denies anon every privilege on %s", async (table) => {
    expect(await tablePrivileges(db, table, "anon")).toEqual([]);
  });

  it("denies an unauthenticated read outright", async () => {
    for (const table of ["customers", "invoices", "employees", "centers", "center_memberships"]) {
      const result = await asRole(db, { role: "anon", uid: null },
        `SELECT count(*) FROM public.${table}`);
      expect(result.outcome, `anon must not read ${table}`).toBe("denied");
    }
  });
});

describe("Data API grant contract — future objects are not auto-exposed", () => {
  it("does not leak a newly created table to the client roles", async () => {
    // Reproduces the post-2026-10-30 platform rule locally: a table added by a
    // later migration must be invisible until someone grants it deliberately.
    await db.exec("CREATE TABLE IF NOT EXISTS public.contract_probe_tmp (id int primary key)");
    try {
      expect(await tablePrivileges(db, "contract_probe_tmp", "anon")).toEqual([]);
      expect(await tablePrivileges(db, "contract_probe_tmp", "authenticated")).toEqual([]);
    } finally {
      await db.exec("DROP TABLE IF EXISTS public.contract_probe_tmp");
    }
  });
});

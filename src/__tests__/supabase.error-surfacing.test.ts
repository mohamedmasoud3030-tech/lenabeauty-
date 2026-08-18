/**
 * Regression suite for silently-swallowed Supabase errors.
 *
 * The failure mode these tests prevent is the most dangerous kind in a data
 * app: a query fails, the code falls back to `(data || [])`, and the UI renders
 * a confident, wrong answer — an empty backup, a report that overstates income,
 * a financial summary showing zero liability. Nothing looks broken, so nobody
 * investigates.
 *
 * Each test drives the real adapter with a stubbed Supabase client whose query
 * returns an error, and asserts the adapter reports that failure instead of
 * returning plausible-looking data.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("../infrastructure/tenantContext", () => ({
  tenantContext: { activeCenterId: "center-1" },
  requireConfiguredCenterId: vi.fn(() => "center-1"),
}));

vi.mock("../infrastructure/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

import {
  SupabaseSettingsAdapter,
  SupabaseReportAdapter,
  SupabaseEntitlementAdapter,
} from "../infrastructure/supabase/repositories";

/**
 * A chainable PostgREST-style stub. Every filter/order method returns `this`,
 * and the chain resolves to `result` when awaited or when `.range()` /
 * `.maybeSingle()` terminates it.
 */
function queryStub(result: { data: unknown; error: unknown }) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lt: () => chain,
    lte: () => chain,
    in: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => Promise.resolve(result),
    // `.maybeSingle()` yields a row object or null — never a list.
    maybeSingle: () => Promise.resolve(
      result.error ? result : { data: null, error: null }),
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

const OK = { data: [], error: null };
const BOOM = { data: null, error: { message: "connection reset by peer" } };

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { employees: [] }, error: null });
});

describe("backup export never reports success on a partial read", () => {
  // Attendance, advances and payroll were previously excluded from the error
  // check, so a failure there produced a "successful" backup missing all of
  // that history — silent data loss at exactly the moment the owner is trying
  // to protect their data.
  it.each([
    "attendance_records",
    "employee_advances",
    "payroll_runs",
    "payroll_line_items",
  ])("fails when %s cannot be read", async (failingTable) => {
    mockFrom.mockImplementation((table: string) =>
      queryStub(table === failingTable ? BOOM : OK));

    const result = await new SupabaseSettingsAdapter().exportData();

    expect(result.ok, `${failingTable} failure must not be swallowed`).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(failingTable);
  });

  it("still fails loudly for the already-covered core tables", async () => {
    mockFrom.mockImplementation((table: string) =>
      queryStub(table === "customers" ? BOOM : OK));

    const result = await new SupabaseSettingsAdapter().exportData();
    expect(result.ok).toBe(false);
  });

  it("succeeds when every table reads cleanly", async () => {
    mockFrom.mockImplementation(() => queryStub(OK));
    const result = await new SupabaseSettingsAdapter().exportData();
    expect(result.ok).toBe(true);
  });
});

describe("backup export is not silently truncated by the PostgREST row cap", () => {
  it("pages past the 1000-row limit instead of stopping at the first page", async () => {
    // PostgREST returns HTTP 200 with exactly `max_rows` rows and no error, so
    // truncation is invisible unless the client pages explicitly.
    const TOTAL = 2300;
    const invoiceRows = Array.from({ length: TOTAL }, (_, i) => ({
      id: `inv-${i}`,
      center_id: "center-1",
      customer_id: "cus-1",
      total_amount: 1,
      payment_method: "CASH",
      status: "PAID",
      date: "2026-08-01T00:00:00.000Z",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table !== "invoices") return queryStub(OK);
      // Emulate PostgREST: `.range(from, to)` returns at most that window.
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        range: (from: number, to: number) =>
          Promise.resolve({ data: invoiceRows.slice(from, to + 1), error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (res: any, rej: any) => Promise.resolve(OK).then(res, rej),
      };
      return chain;
    });

    const result = await new SupabaseSettingsAdapter().exportData();
    expect(result.ok).toBe(true);
    if (result.ok) {
      // All 2300 rows, not the first 1000 the server would have returned.
      expect(result.data.data.invoices).toHaveLength(TOTAL);
    }
  });
});

describe("sales report never misclassifies prepaid redemptions as cash revenue", () => {
  it("fails when the entitlement ledger lookup errors", async () => {
    // Ignoring this error silently reclassifies redeemed prepaid value as
    // ordinary income, overstating revenue with no warning.
    mockFrom.mockImplementation((table: string) => {
      if (table === "entitlement_ledger") return queryStub(BOOM);
      if (table === "invoices") {
        return queryStub({
          data: [{ id: "inv-1", center_id: "center-1", status: "PAID", total_amount: 10, invoice_items: [] }],
          error: null,
        });
      }
      return queryStub(OK);
    });

    const result = await new SupabaseReportAdapter().getSales("2026-08-01", "2026-08-31");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("entitlement_ledger");
  });
});

describe("entitlement financial summary never reports fabricated totals", () => {
  it.each([
    "payments",
    "invoices",
    "entitlement_ledger",
    "customer_entitlements",
  ])("fails when %s cannot be read", async (failingTable) => {
    // Swallowing any of these renders a headline number that looks authoritative
    // but is wrong — e.g. zero deferred liability while real prepaid balances
    // are outstanding.
    mockFrom.mockImplementation((table: string) =>
      queryStub(table === failingTable ? BOOM : OK));

    const result = await new SupabaseEntitlementAdapter().getSummary();
    expect(result.ok, `${failingTable} failure must not be swallowed`).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(failingTable);
  });

  it("returns a summary when every source reads cleanly", async () => {
    mockFrom.mockImplementation(() => queryStub(OK));
    const result = await new SupabaseEntitlementAdapter().getSummary();
    expect(result.ok).toBe(true);
  });
});

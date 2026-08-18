import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression suite for five silent data-integrity defects.
 *
 * Every defect here shares one dangerous property: the operation still
 * *reports success* while producing wrong or incomplete data. Nothing crashes,
 * nothing logs, and the owner has no way to notice.
 *
 *   D-1  backup silently truncated at the PostgREST row cap
 *   D-2  backup read failures swallowed into empty arrays
 *   D-3  backup export claims success on a partial read
 *   D-4  accrual (entitlement_ledger) failure reclassifies prepaid liability
 *        as earned revenue
 *   D-5  forecast reads invoice_items without a center scope
 *
 * Behaviour reference: PR #35. This is an independent re-implementation with
 * executable proof rather than a port of that branch.
 */

vi.mock("../infrastructure/tenantContext", () => ({
  tenantContext: { activeCenterId: CENTER_ID },
  requireConfiguredCenterId: vi.fn(() => CENTER_ID),
}));

const CENTER_ID = "center-under-test";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, rpc: mockRpc, auth: {} })),
}));

const OK = { data: [] as unknown[], error: null };
const FAILURE = { data: null, error: { message: "connection reset by peer" } };

/** Server-side row cap PostgREST applies silently (Supabase default). */
const SERVER_ROW_CAP = 1000;

interface StubOptions {
  /** Rows the table holds; `.range()` slices them like PostgREST does. */
  rows?: unknown[];
  /** Force this table to fail. */
  fail?: boolean;
  /** Record every filter applied, so tenant scoping can be asserted. */
  filters?: { column: string; value: unknown }[];
}

/**
 * Minimal PostgREST-shaped query stub.
 *
 * Two behaviours matter and are faithfully reproduced:
 *  - `.range(from, to)` returns at most that window — never more;
 *  - awaiting the builder WITHOUT `.range()` returns at most `SERVER_ROW_CAP`
 *    rows with `error: null`, exactly how a real server truncates in silence.
 */
function tableStub(options: StubOptions = {}) {
  const rows = options.rows ?? [];
  const chain: Record<string, unknown> = {};

  const passthrough = (name: string) => (column?: string, value?: unknown) => {
    if (options.filters && typeof column === "string") {
      options.filters.push({ column, value });
    }
    void name;
    return chain;
  };

  for (const method of ["select", "eq", "gte", "lte", "lt", "in", "not", "order", "limit"]) {
    chain[method] = passthrough(method);
  }

  chain.range = (from: number, to: number) =>
    Promise.resolve(options.fail ? FAILURE : { data: rows.slice(from, to + 1), error: null });

  chain.maybeSingle = () =>
    Promise.resolve(options.fail ? FAILURE : { data: null, error: null });

  // Awaiting without .range() = the silent server cap.
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(
      options.fail ? FAILURE : { data: rows.slice(0, SERVER_ROW_CAP), error: null },
    ).then(resolve, reject);

  return chain;
}

const BACKUP_TABLES = [
  "customers", "services", "appointments", "products", "expenses",
  "center_settings", "invoices", "attendance_records", "employee_advances",
  "payroll_runs", "payroll_line_items",
];

async function loadAdapters() {
  vi.resetModules();
  const env = await import("../config/env");
  (env.config as Record<string, unknown>).backend = "supabase";
  (env.config as Record<string, unknown>).supabaseUrl = "https://stub.supabase.co";
  (env.config as Record<string, unknown>).supabasePublishableKey = "stub-key";
  (env.config as Record<string, unknown>).centerId = CENTER_ID;
  (env.config as Record<string, unknown>).branchMode = "single";
  return import("../infrastructure/supabase/repositories");
}

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: { employees: [] }, error: null });
});

/* ── D-1: silent truncation at the row cap ───────────────────────────────── */

describe("D-1 backup is never silently truncated at the PostgREST row cap", () => {
  it("exports every invoice when the tenant holds more rows than the server cap", async () => {
    const total = SERVER_ROW_CAP * 2 + 317;
    const invoices = Array.from({ length: total }, (_, index) => ({
      id: `invoice-${index}`,
      center_id: CENTER_ID,
      customer_id: "customer-1",
      total_amount: 1,
      payment_method: "CASH",
      status: "PAID",
      date: "2026-08-01T00:00:00.000Z",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    }));

    mockFrom.mockImplementation((table: string) =>
      tableStub({ rows: table === "invoices" ? invoices : [] }));

    const { SupabaseSettingsAdapter } = await loadAdapters();
    const result = await new SupabaseSettingsAdapter().exportData();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.data.data.invoices,
      "a backup that stops at the server cap is silent data loss",
    ).toHaveLength(total);
  });

  it("terminates on an exact multiple of the page size", async () => {
    const invoices = Array.from({ length: SERVER_ROW_CAP }, (_, index) => ({
      id: `invoice-${index}`,
      center_id: CENTER_ID,
      customer_id: "customer-1",
      total_amount: 1,
      payment_method: "CASH",
      status: "PAID",
      date: "2026-08-01T00:00:00.000Z",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    }));

    mockFrom.mockImplementation((table: string) =>
      tableStub({ rows: table === "invoices" ? invoices : [] }));

    const { SupabaseSettingsAdapter } = await loadAdapters();
    const result = await new SupabaseSettingsAdapter().exportData();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.data.invoices).toHaveLength(SERVER_ROW_CAP);
  });
});

/* ── D-2 / D-3: swallowed read failures ──────────────────────────────────── */

describe("D-2/D-3 a partial backup read fails loudly instead of returning []", () => {
  it.each(BACKUP_TABLES)("fails the whole export when %s cannot be read", async (failingTable) => {
    mockFrom.mockImplementation((table: string) =>
      tableStub({ fail: table === failingTable }));

    const { SupabaseSettingsAdapter } = await loadAdapters();
    const result = await new SupabaseSettingsAdapter().exportData();

    expect(
      result.ok,
      `${failingTable} failed but the backup still reported success`,
    ).toBe(false);
    if (!result.ok) {
      expect(
        result.error.message,
        "the error must name the table that failed",
      ).toContain(failingTable);
    }
  });

  it("fails when the employees RPC errors", async () => {
    mockFrom.mockImplementation(() => tableStub());
    mockRpc.mockResolvedValue(FAILURE);

    const { SupabaseSettingsAdapter } = await loadAdapters();
    const result = await new SupabaseSettingsAdapter().exportData();

    expect(result.ok).toBe(false);
  });

  it("succeeds when every source reads cleanly", async () => {
    mockFrom.mockImplementation(() => tableStub());

    const { SupabaseSettingsAdapter } = await loadAdapters();
    const result = await new SupabaseSettingsAdapter().exportData();

    expect(result.ok).toBe(true);
  });
});

/* ── D-4: accrual failure must never invent revenue ──────────────────────── */

describe("D-4 an accrual read failure never reclassifies prepaid liability as revenue", () => {
  it("fails the sales report when entitlement_ledger cannot be read", async () => {
    const invoices = [{
      id: "invoice-1",
      center_id: CENTER_ID,
      customer_id: "customer-1",
      total_amount: 100,
      tax: 0,
      gift_card_discount: 100,
      status: "PAID",
      date: "2026-08-01T00:00:00.000Z",
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      invoice_items: [],
    }];

    mockFrom.mockImplementation((table: string) => {
      if (table === "entitlement_ledger") return tableStub({ fail: true });
      return tableStub({ rows: table === "invoices" ? invoices : [] });
    });

    const { SupabaseReportAdapter } = await loadAdapters();
    // getSales validates a strict YYYY-MM-DD range before querying.
    const result = await new SupabaseReportAdapter().getSales("2026-08-01", "2026-08-31");

    expect(
      result.ok,
      "a swallowed ledger error silently turns prepaid redemption into cash revenue",
    ).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("entitlement_ledger");
  });

  it("fails the entitlement summary when any financial source errors", async () => {
    for (const failing of ["payments", "invoices", "entitlement_ledger", "customer_entitlements"]) {
      mockFrom.mockImplementation((table: string) =>
        tableStub({ fail: table === failing }));

      const { SupabaseEntitlementAdapter } = await loadAdapters();
      const result = await new SupabaseEntitlementAdapter().getSummary();

      expect(
        result.ok,
        `${failing} failed but the summary still reported a confident figure`,
      ).toBe(false);
    }
  });

  it("still succeeds when every financial source reads cleanly", async () => {
    mockFrom.mockImplementation(() => tableStub());

    const { SupabaseEntitlementAdapter } = await loadAdapters();
    const result = await new SupabaseEntitlementAdapter().getSummary();

    expect(result.ok).toBe(true);
  });
});

/* ── D-5: tenant scoping ─────────────────────────────────────────────────── */

describe("D-5 forecast reads are explicitly scoped to the active center", () => {
  it("scopes invoice_items through its parent invoice", async () => {
    const filters: { column: string; value: unknown }[] = [];

    mockFrom.mockImplementation((table: string) =>
      tableStub(table === "invoice_items" ? { filters } : {}));

    const { SupabaseForecastAdapter } = await loadAdapters();
    const result = await new SupabaseForecastAdapter().getInventoryForecast();

    expect(result.ok).toBe(true);
    expect(
      filters.some((f) => f.column.endsWith("center_id") && f.value === CENTER_ID),
      "invoice_items has no center_id of its own; it must be scoped via its invoice",
    ).toBe(true);
  });

  it("keeps the products read scoped to the active center", async () => {
    const filters: { column: string; value: unknown }[] = [];

    mockFrom.mockImplementation((table: string) =>
      tableStub(table === "products" ? { filters } : {}));

    const { SupabaseForecastAdapter } = await loadAdapters();
    await new SupabaseForecastAdapter().getInventoryForecast();

    expect(filters).toContainEqual({ column: "center_id", value: CENTER_ID });
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/tenantContext", () => ({
  tenantContext: { activeCenterId: "center-1" },
  requireConfiguredCenterId: vi.fn(() => "center-1"),
}));

const mockFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, auth: {} })),
}));

vi.mock("../config/env", () => ({
  config: {
    backend: "supabase",
    branchMode: "single",
    centerId: "center-1",
    supabaseUrl: "https://mock.supabase.co",
    supabasePublishableKey: "mock-key",
  },
  EnvironmentConfigurationError: class extends Error {},
}));

import { SupabaseReportAdapter } from "../infrastructure/supabase/repositories";
import { localDateRangeISO } from "../shared/dateRange";

const originalTimezone = process.env.TZ;

type RangeQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

function rangeQuery(rows: Record<string, unknown>[], dateField: string): RangeQuery {
  let lower = "";
  let upper = "";
  const query = {} as RangeQuery;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gte = vi.fn((_field: string, value: string) => {
    lower = value;
    return query;
  });
  query.lt = vi.fn((_field: string, value: string) => {
    upper = value;
    return query;
  });
  query.order = vi.fn(async () => ({
    data: rows.filter((row) => {
      const instant = new Date(String(row[dateField])).getTime();
      return instant >= new Date(lower).getTime() && instant < new Date(upper).getTime();
    }),
    error: null,
  }));
  return query;
}

function invoiceRow(id: string, date: string) {
  return {
    id,
    customer_id: "customer-1",
    total_amount: 5,
    discount: 0,
    payment_method: "cash",
    date,
    created_at: date,
    updated_at: date,
    customers: { name: "Demo customer" },
    invoice_items: [],
  };
}

function appointmentRow(id: string, dateTime: string) {
  return {
    id,
    date_time: dateTime,
    status: "SCHEDULED",
    customer_id: "customer-1",
    employee_id: "employee-1",
    service_id: "service-1",
    customers: { name: "Demo customer" },
    employees: { name: "Demo employee" },
    services: { name: "Demo service" },
  };
}

describe("inclusive local report date ranges", () => {
  beforeAll(() => {
    process.env.TZ = "Asia/Muscat";
  });

  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses local midnight through the next local midnight as an exclusive bound", () => {
    const range = localDateRangeISO("2026-08-10", "2026-08-10");
    const endOfSelectedDay = new Date(2026, 7, 10, 23, 59, 59, 999);
    const nextDayStart = new Date(2026, 7, 11, 0, 0, 0, 0);

    expect(new Date(range.fromISO).getHours()).toBe(0);
    expect(range.toExclusiveISO).toBe(nextDayStart.toISOString());
    expect(endOfSelectedDay.getTime()).toBeLessThan(new Date(range.toExclusiveISO).getTime());
    expect(nextDayStart.getTime()).not.toBeLessThan(new Date(range.toExclusiveISO).getTime());
  });

  it("includes sales and appointments at 23:59 and excludes the next day", async () => {
    const at2359 = new Date(2026, 7, 10, 23, 59, 0, 0).toISOString();
    const nextDay = new Date(2026, 7, 11, 0, 0, 0, 0).toISOString();
    const salesQuery = rangeQuery(
      [invoiceRow("sale-at-2359", at2359), invoiceRow("sale-next-day", nextDay)],
      "date",
    );
    const appointmentsQuery = rangeQuery(
      [appointmentRow("appointment-at-2359", at2359), appointmentRow("appointment-next-day", nextDay)],
      "date_time",
    );
    mockFrom.mockImplementation((table: string) => {
      if (table === "invoices") return salesQuery;
      if (table === "appointments") return appointmentsQuery;
      throw new Error(`Unexpected table: ${table}`);
    });

    const adapter = new SupabaseReportAdapter();
    const sales = await adapter.getSales("2026-08-10", "2026-08-10");
    const appointments = await adapter.getAppointments("2026-08-10", "2026-08-10");
    const expectedRange = localDateRangeISO("2026-08-10", "2026-08-10");

    expect(sales).toMatchObject({ ok: true, data: [{ id: "sale-at-2359" }] });
    expect(appointments).toMatchObject({ ok: true, data: [{ id: "appointment-at-2359" }] });
    expect(salesQuery.gte).toHaveBeenCalledWith("date", expectedRange.fromISO);
    expect(salesQuery.lt).toHaveBeenCalledWith("date", expectedRange.toExclusiveISO);
    expect(appointmentsQuery.gte).toHaveBeenCalledWith("date_time", expectedRange.fromISO);
    expect(appointmentsQuery.lt).toHaveBeenCalledWith("date_time", expectedRange.toExclusiveISO);
  });

  it("rejects impossible or reversed date selections", () => {
    expect(() => localDateRangeISO("2026-02-30", "2026-03-01")).toThrow(/valid calendar date/);
    expect(() => localDateRangeISO("2026-08-11", "2026-08-10")).toThrow(/must not be after/);
  });
});

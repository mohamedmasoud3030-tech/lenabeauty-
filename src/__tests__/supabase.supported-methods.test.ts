import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("../infrastructure/tenantContext", () => ({
  tenantContext: { activeCenterId: "center-1" },
  requireConfiguredCenterId: vi.fn(() => "center-1"),
}));

vi.mock("../infrastructure/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { SupabaseCustomerAdapter, SupabaseExpenseAdapter } from "../infrastructure/supabase/repositories";

function selectRows(rows: unknown[]) {
  const response = { data: rows, error: null };
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => response),
  };
  return chain;
}

function updateRow(row: unknown) {
  const response = { data: row, error: null };
  const chain: any = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(() => response),
  };
  return chain;
}

describe("Supabase supported adapter methods", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("Customer.getHistory maps appointments and invoices when Supabase is available", async () => {
    mockFrom
      .mockImplementationOnce(() => selectRows([{
        id: "appointment-1",
        customer_id: "customer-1",
        employee_id: "employee-1",
        service_id: "service-1",
        center_id: "center-1",
        date_time: "2026-06-23T10:00:00.000Z",
        status: "SCHEDULED",
        created_at: "2026-06-20T10:00:00.000Z",
        updated_at: "2026-06-20T10:00:00.000Z",
      }]))
      .mockImplementationOnce(() => selectRows([{
        id: "invoice-1",
        customer_id: "customer-1",
        center_id: "center-1",
        total_amount: 42,
        payment_method: "cash",
        date: "2026-06-23",
        created_at: "2026-06-23T10:00:00.000Z",
        updated_at: "2026-06-23T10:00:00.000Z",
      }]));

    const result = await new SupabaseCustomerAdapter().getHistory("customer-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.appointments[0].id).toBe("appointment-1");
      expect(result.data.invoices[0].id).toBe("invoice-1");
    }
  });

  it("Expense.update returns the updated expense when Supabase is available", async () => {
    mockFrom.mockImplementationOnce(() => updateRow({
      id: "expense-1",
      center_id: "center-1",
      amount: 55,
      category: "Supplies",
      description: "Updated towels",
      date: "2026-06-23",
      created_at: "2026-06-20T10:00:00.000Z",
    }));

    const result = await new SupabaseExpenseAdapter().update("expense-1", {
      amount: 55,
      category: "Supplies",
      description: "Updated towels",
      date: new Date("2026-06-23T00:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("expense-1");
      expect(result.data.amount).toBe(55);
      expect(result.data.category).toBe("Supplies");
    }
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("../infrastructure/tenantContext", () => ({
  tenantContext: { activeCenterId: "center-1" },
  requireConfiguredCenterId: vi.fn(() => "center-1"),
}));

vi.mock("../infrastructure/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({ from: mockFrom })),
}));

import { SupabaseSettingsAdapter } from "../infrastructure/supabase/repositories";
import type { BackupPayload } from "../application/dto";

describe("Settings.restore (now implemented)", () => {
  beforeEach(() => mockFrom.mockReset());

  it("rejects an invalid backup payload with VALIDATION_ERROR", async () => {
    const res = await new SupabaseSettingsAdapter().restore({} as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("upserts customers/products and stamps the active center_id", async () => {
    const upserts: Record<string, any[]> = {};
    mockFrom.mockImplementation((table: string) => ({
      upsert: vi.fn((rows: any[]) => {
        upserts[table] = rows;
        return { error: null };
      }),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    }));

    const payload: BackupPayload = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      data: {
        customers: [
          { id: "c1", name: "Sara", totalSpent: 10, loyaltyPoints: 5,
            createdAt: new Date(), updatedAt: new Date() } as any,
        ],
        products: [
          { id: "p1", name: "Shampoo", price: 3, cost: 1, stockQuantity: 8,
            createdAt: new Date(), updatedAt: new Date() } as any,
        ],
      },
    };

    const res = await new SupabaseSettingsAdapter().restore(payload);
    expect(res.ok).toBe(true);
    expect(upserts.customers[0]).toMatchObject({ id: "c1", name: "Sara", center_id: "center-1", loyalty_points: 5 });
    expect(upserts.products[0]).toMatchObject({ id: "p1", center_id: "center-1", stock_quantity: 8 });
  });

  it("does NOT attempt to restore invoices (financial integrity)", async () => {
    const touched: string[] = [];
    mockFrom.mockImplementation((table: string) => {
      touched.push(table);
      return {
        upsert: vi.fn(() => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      };
    });

    const payload: BackupPayload = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      data: {
        invoices: [{ id: "i1", customerId: "c1", totalAmount: 50 } as any],
        customers: [{ id: "c1", name: "X", totalSpent: 0, loyaltyPoints: 0, createdAt: new Date(), updatedAt: new Date() } as any],
      },
    };

    const res = await new SupabaseSettingsAdapter().restore(payload);
    expect(res.ok).toBe(true);
    expect(touched).not.toContain("invoices");
    expect(touched).not.toContain("invoice_items");
  });
});

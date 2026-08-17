import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { createRepositoryBundle } from "../infrastructure/createRepositoryBundle";

describe("repository-boundary validation (UI bypassed)", () => {
  const bundle = createRepositoryBundle();

  beforeEach(() => vi.clearAllMocks());

  it("rejects a service with a negative price before touching Supabase", async () => {
    mockFrom.mockReturnValue({ insert: vi.fn(), update: vi.fn() });
    const res = await bundle.serviceAdapter.create({ name: "Cut", price: -5, durationMinutes: 30 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("VALIDATION_ERROR");
      expect((res.error as any).issues.some((i: any) => i.field === "price")).toBe(true);
    }
    expect(mockFrom).not.toHaveBeenCalledWith("services");
  });

  it("rejects a service with an empty name", async () => {
    const res = await bundle.serviceAdapter.create({ name: "", price: 10, durationMinutes: 30 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a service with invalid (non-numeric) price text", async () => {
    const res = await bundle.serviceAdapter.create({ name: "Cut", price: "abc" as any, durationMinutes: 30 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "price")).toBe(true);
  });

  it("rejects a product with negative stock", async () => {
    const res = await bundle.productAdapter.create({ name: "Shampoo", price: 5, cost: 2, stockQuantity: -1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
    expect(mockFrom).not.toHaveBeenCalledWith("products");
  });

  it("rejects an expense with zero/negative amount", async () => {
    const res = await bundle.expenseAdapter.create({ amount: -1, category: "Rent" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "amount")).toBe(true);
  });

  it("rejects an employee with an out-of-range commission", async () => {
    const res = await bundle.employeeAdapter.create({ name: "Sara", baseSalary: 100, commissionPercentage: 150 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "commission")).toBe(true);
  });

  it("rejects a negative employee salary", async () => {
    const res = await bundle.employeeAdapter.create({ name: "Sara", baseSalary: -50, commissionPercentage: 10 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an advance with a non-positive amount", async () => {
    const res = await bundle.advanceAdapter.create({ employeeId: "e1", amount: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "amount")).toBe(true);
  });

  it("rejects an attendance record with negative work hours", async () => {
    const res = await bundle.attendanceAdapter.create({ employeeId: "e1", workHours: -3 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("sanitizes brand colors to strict #RRGGBB before writing settings to Supabase", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const updateFn = vi.fn((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return {
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { center_id: "center-1", name: "Test Salon" }, error: null })),
          })),
        })),
      };
    });
    mockFrom.mockReturnValue({ update: updateFn });

    const res = await bundle.settingsAdapter.update({
      displayName: "Test Salon",
      brandPrimaryColor: "red; } body { display: none; }",
      brandSecondaryColor: "url(https://attacker.invalid/leak)",
      brandAccentColor: "#06B6D4",
    });

    expect(res.ok).toBe(true);
    // CSS payloads can never reach the database: invalid colors fall back to
    // the canonical palette while valid colors pass through unchanged.
    expect(capturedPayload).not.toBeNull();
    // (cast through unknown: TS cannot track the closure assignment above)
    const payload = capturedPayload as unknown as Record<string, unknown>;
    expect(payload.brand_primary_color).toBe("#8B5CF6");
    expect(payload.brand_secondary_color).toBe("#EC4899");
    expect(payload.brand_accent_color).toBe("#06B6D4");
  });

  it("writes brand_logo_base64: null to Supabase so a cleared logo is actually removed remotely", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const updateFn = vi.fn((payload: Record<string, unknown>) => {
      capturedPayload = payload;
      return {
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { center_id: "center-1", name: "Test Salon" }, error: null })),
          })),
        })),
      };
    });
    mockFrom.mockReturnValue({ update: updateFn });

    const res = await bundle.settingsAdapter.update({ brandLogoBase64: null });

    expect(res.ok).toBe(true);
    expect(capturedPayload).not.toBeNull();
    const payload = capturedPayload as unknown as Record<string, unknown>;
    // undefined would be dropped by the adapter and leave the remote logo
    // untouched; null must reach the update payload so Postgres clears it.
    expect("brand_logo_base64" in payload).toBe(true);
    expect(payload.brand_logo_base64).toBeNull();
  });

  it("rejects a settings update with an out-of-range tax rate", async () => {
    const res = await bundle.settingsAdapter.update({ name: "Salon", taxRate: 120 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "taxRate")).toBe(true);
  });

  it("rejects a customer with an invalid phone and email", async () => {
    const res = await bundle.customerAdapter.create({ name: "A", phone: "abc", email: "nope" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect((res.error as any).issues.some((i: any) => i.field === "phone")).toBe(true);
      expect((res.error as any).issues.some((i: any) => i.field === "email")).toBe(true);
    }
  });

  it("rejects an appointment with a negative deposit", async () => {
    const res = await bundle.appointmentAdapter.create({ customerId: "c1", depositAmount: -10 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "depositAmount")).toBe(true);
  });

  it("rejects an accounting journal entry with a negative amount", async () => {
    const res = await bundle.accountingAdapter.createJournalEntry({ description: "x", amount: -5, entryType: "ADJUSTMENT", debitAccount: "Cash", creditAccount: "Sales" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a package with a negative price", async () => {
    const res = await bundle.servicePackageAdapter.create({ name: "Pkg", packagePrice: -1, items: [{ serviceId: "s1", quantity: 1 }] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a review with a rating outside 1..5", async () => {
    const res = await bundle.customerExperienceAdapter.createReview({ customerId: "c1", rating: 9 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "rating")).toBe(true);
  });
});

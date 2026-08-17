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

  it("rejects a settings update with an out-of-range tax rate", async () => {
    const res = await bundle.settingsAdapter.update({ name: "Salon", taxRate: 120 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as any).issues.some((i: any) => i.field === "taxRate")).toBe(true);
  });

  it("rejects unsafe logo MIME types before touching Storage", async () => {
    const res = await bundle.settingsAdapter.uploadLogo(new File(["<svg/>"] , "logo.svg", { type: "image/svg+xml" }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("VALIDATION_ERROR");
      expect((res.error as any).issues.some((i: any) => i.key === "validation.logo_type")).toBe(true);
    }
  });

  it("rejects logos larger than the 2 MiB bucket contract", async () => {
    const oversized = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    const res = await bundle.settingsAdapter.uploadLogo(oversized);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("VALIDATION_ERROR");
      expect((res.error as any).issues.some((i: any) => i.key === "validation.logo_size")).toBe(true);
    }
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

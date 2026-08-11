import { describe, expect, it } from "vitest";
import { validateCheckoutPayload, validateBackupPayload } from "../application/dto";
import { validateCheckoutContract, calculateCheckoutTotals, estimatePackageRedemptionValue, roundMoney } from "../domain/commerce";
import { mapSalesReportRows } from "../infrastructure/supabase/salesReportMapper";

function invoiceRow(overrides: Record<string, any> = {}) {
  return {
    id: "inv-1",
    customer_id: "c-1",
    total_amount: 0,
    discount: 0,
    payment_method: "CASH",
    date: "2026-08-10T10:00:00Z",
    created_at: "2026-08-10T10:00:00Z",
    updated_at: "2026-08-10T10:00:00Z",
    ...overrides,
  };
}

describe("entitlement checkout contract", () => {
  it("accepts a gift-card sale line with a code, value, and qty 1", () => {
    const errors = validateCheckoutPayload({
      customerId: "c1",
      employeeId: "e1",
      paymentMethod: "cash",
      items: [{ type: "gift_card", code: "GC-100", price: 20, qty: 1 }],
    });
    expect(errors).toEqual([]);
    expect(validateCheckoutContract({
      customerId: "c1",
      employeeId: "e1",
      paymentMethod: "cash",
      items: [{ type: "gift_card", code: "GC-100", price: 20, qty: 1 }],
    })).toEqual([]);
  });

  it("rejects gift-card sale lines with a short code or qty different from 1", () => {
    expect(validateCheckoutPayload({
      customerId: "c1", employeeId: "e1", paymentMethod: "cash",
      items: [{ type: "gift_card", code: "AB", price: 20, qty: 1 }],
    }).length).toBeGreaterThan(0);
    expect(validateCheckoutPayload({
      customerId: "c1", employeeId: "e1", paymentMethod: "cash",
      items: [{ type: "gift_card", code: "GC-100", price: 20, qty: 2 }],
    }).length).toBeGreaterThan(0);
  });

  it("accepts valid entitlement redemptions and rejects duplicates", () => {
    const base = {
      customerId: "c1", employeeId: "e1", paymentMethod: "cash" as const,
      items: [{ type: "service" as const, serviceId: "s1", qty: 1, price: 10 }],
    };
    expect(validateCheckoutPayload({
      ...base,
      entitlementRedemptions: [{ entitlementId: "ent-1", type: "units", serviceId: "s1", units: 1 }],
    })).toEqual([]);
    expect(validateCheckoutPayload({
      ...base,
      entitlementRedemptions: [
        { entitlementId: "ent-1", type: "units", serviceId: "s1", units: 1 },
        { entitlementId: "ent-1", type: "value", amount: 5 },
      ],
    }).length).toBeGreaterThan(0);
    expect(validateCheckoutPayload({
      ...base,
      entitlementRedemptions: [{ entitlementId: "ent-1", type: "units", units: 1 }],
    }).length).toBeGreaterThan(0);
    expect(validateCheckoutContract({
      ...base,
      entitlementRedemptions: [{ entitlementId: "ent-1", type: "value", amount: 3 }],
    })).toEqual([]);
  });
});

describe("entitlement redemption preview math", () => {
  it("covers average line price × units, capped at the remaining value", () => {
    const value = estimatePackageRedemptionValue(
      { type: "units", entitlementId: "ent-1", units: 2, serviceId: "s1" },
      18,
      [{ serviceId: "s1", price: 10, qty: 2 }],
    );
    // avg 10 × 2 = 20, capped at the remaining 18 — never over-redeems.
    expect(value).toBe(18);
  });

  it("never over-redeems a partially used package", () => {
    const value = estimatePackageRedemptionValue(
      { type: "units", entitlementId: "ent-1", units: 1, serviceId: "s1" },
      8,
      [{ serviceId: "s1", price: 10, qty: 1 }],
    );
    expect(value).toBe(8);
  });

  it("returns zero for non-unit redemptions or missing service lines", () => {
    expect(estimatePackageRedemptionValue({ type: "value", entitlementId: "ent-1", amount: 5 }, 10, [])).toBe(0);
    expect(estimatePackageRedemptionValue(
      { type: "units", entitlementId: "ent-1", units: 1, serviceId: "s1" },
      10,
      [{ serviceId: "s2", price: 10, qty: 1 }],
    )).toBe(0);
  });

  it("caps entitlement redemption in the totals preview after gift card and discounts", () => {
    const totals = calculateCheckoutTotals({
      items: [{ price: 50, qty: 1 }],
      manualDiscount: 0,
      tierPercent: 0,
      loyaltyPoints: 0,
      useLoyaltyPoints: false,
      giftCardBalance: 10,
      entitlementRedemption: 999,
      taxRate: 0,
    });
    expect(totals.giftCardDiscount).toBe(10);
    expect(totals.entitlementRedemption).toBe(40); // capped at the remaining payable
    expect(totals.total).toBe(0);
    expect(totals.net).toBe(0);
  });
});

describe("sales report classification (prepaid vs earned vs redeemed)", () => {
  it("books a gift-card sale as prepaid, NOT earned revenue", () => {
    const rows = [invoiceRow({
      total_amount: 20,
      invoice_items: [
        { id: "li-1", invoice_id: "inv-1", gift_card_id: "gc-1", item_type: "gift_card", item_name: "Gift Card GC-100", price: 20, quantity: 1, gift_cards: { code: "GC-100" } },
      ],
    })];
    const [row] = mapSalesReportRows(rows);
    expect(row.prepaidAmount).toBe(20);
    expect(row.redeemedAmount).toBe(0);
    expect(row.earnedRevenue).toBe(0);
    expect(row.items[0].type).toBe("gift_card");
  });

  it("recognizes service revenue exactly once when an entitlement is redeemed", () => {
    const rows = [invoiceRow({
      total_amount: 50, // cash collected after the redemption
      invoice_items: [
        { id: "li-1", invoice_id: "inv-1", service_id: "s1", item_type: "service", item_name: "Haircut", price: 100, quantity: 1, services: { name: "Haircut" } },
      ],
    })];
    const redemptionByInvoice = new Map([["inv-1", 50]]);
    const [row] = mapSalesReportRows(rows, redemptionByInvoice);
    expect(row.redeemedAmount).toBe(50);
    expect(row.earnedRevenue).toBe(100); // 50 cash + 50 deferred value converted
  });

  it("falls back to the legacy gift_card_discount column for pre-ledger invoices", () => {
    const rows = [invoiceRow({
      total_amount: 50,
      gift_card_discount: 50,
      invoice_items: [
        { id: "li-1", invoice_id: "inv-1", service_id: "s1", item_type: "service", item_name: "Haircut", price: 100, quantity: 1, services: { name: "Haircut" } },
      ],
    })];
    const [row] = mapSalesReportRows(rows);
    expect(row.redeemedAmount).toBe(50);
    expect(row.earnedRevenue).toBe(100);
  });

  it("treats a package sale as prepaid (deferred), not earned revenue", () => {
    const rows = [invoiceRow({
      total_amount: 18,
      invoice_items: [
        { id: "li-1", invoice_id: "inv-1", package_id: "pkg-1", item_type: "package", item_name: "باقة", price: 18, quantity: 1, service_packages: { name: "باقة" } },
      ],
    })];
    const [row] = mapSalesReportRows(rows);
    expect(row.prepaidAmount).toBe(18);
    expect(row.earnedRevenue).toBe(0);
  });

  it("keeps ordinary paid invoices classified exactly as before", () => {
    const rows = [invoiceRow({
      total_amount: 100,
      invoice_items: [
        { id: "li-1", invoice_id: "inv-1", service_id: "s1", item_type: "service", item_name: "Cut", price: 100, quantity: 1, services: { name: "Cut" } },
      ],
    })];
    const [row] = mapSalesReportRows(rows);
    expect(row.prepaidAmount).toBe(0);
    expect(row.redeemedAmount).toBe(0);
    expect(row.earnedRevenue).toBe(100);
  });
});

describe("rounding helpers stay OMR-safe", () => {
  it("rounds to three decimals without float drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.5555)).toBe(10.556);
  });

  it("keeps backup validation unchanged", () => {
    expect(validateBackupPayload({ version: "1", data: {} })).toBe(true);
  });
});

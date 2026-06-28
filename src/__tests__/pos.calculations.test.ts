import { describe, expect, it } from "vitest";

/**
 * POS calculation invariants — must mirror the server RPC
 * (process_checkout_v1 in docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql):
 *
 *   subtotal        = Σ(price × qty)
 *   loyaltyDiscount = clamp(loyaltyPoints, 0 .. subtotal - discount)   // 1 point = 1 OMR
 *   total           = max(0, subtotal - discount - loyaltyDiscount)
 *   earnedPoints    = floor(total)
 *
 * These mirror the exact expressions used in PosInvoicesPage so the UI
 * preview never disagrees with what the backend will persist.
 */

function subtotalOf(items: { price: number; qty?: number }[]): number {
  return items.reduce((s, it) => s + Number(it.price) * Number(it.qty ?? 1), 0);
}

function loyaltyDiscountOf(subtotal: number, discount: number, points: number, use: boolean): number {
  if (!use) return 0;
  return Math.max(0, Math.min(subtotal - discount, points));
}

function tierDiscountOf(subtotal: number, tierPercent: number): number {
  return Math.round((subtotal * (tierPercent || 0)) / 100 * 1000) / 1000;
}

function netOf(subtotal: number, discount: number, loyalty: number, tierDiscount = 0): number {
  return Math.max(0, subtotal - discount - tierDiscount - loyalty);
}

function taxOf(net: number, taxRate: number): number {
  return Math.round((net * (taxRate || 0)) / 100 * 1000) / 1000;
}

function totalOf(subtotal: number, discount: number, loyalty: number, taxRate = 0): number {
  const net = netOf(subtotal, discount, loyalty);
  return net + taxOf(net, taxRate);
}

describe("POS calculations (mirror server RPC)", () => {
  it("subtotal multiplies price by quantity", () => {
    expect(subtotalOf([{ price: 5, qty: 3 }, { price: 2 }])).toBe(17);
  });

  it("loyalty point is worth 1 OMR (not 1/100)", () => {
    // 500 points on a 200 subtotal => capped at 200, not 5
    expect(loyaltyDiscountOf(200, 0, 500, true)).toBe(200);
    expect(loyaltyDiscountOf(50, 0, 30, true)).toBe(30);
  });

  it("loyalty discount is capped at subtotal minus manual discount", () => {
    expect(loyaltyDiscountOf(100, 20, 1000, true)).toBe(80);
  });

  it("loyalty discount is zero when not used", () => {
    expect(loyaltyDiscountOf(100, 0, 1000, false)).toBe(0);
  });

  it("total never goes negative", () => {
    const sub = subtotalOf([{ price: 10 }]);
    const loy = loyaltyDiscountOf(sub, 0, 1000, true);
    expect(totalOf(sub, 0, loy)).toBe(0);
  });

  it("earned points = floor(net) (pre-tax)", () => {
    const sub = subtotalOf([{ price: 12.7, qty: 2 }]); // 25.4
    const net = netOf(sub, 5, 0); // 20.4
    expect(Math.floor(net)).toBe(20);
  });

  it("applies VAT on the net (post-discount, pre-tax) amount", () => {
    const sub = subtotalOf([{ price: 100 }]); // 100
    const net = netOf(sub, 0, 0); // 100
    expect(taxOf(net, 5)).toBe(5); // 5% VAT (Oman)
    expect(totalOf(sub, 0, 0, 5)).toBe(105);
  });

  it("VAT is computed after discounts, not before", () => {
    const sub = subtotalOf([{ price: 100 }]);
    // 20 discount -> net 80 -> 5% = 4 -> total 84
    expect(totalOf(sub, 20, 0, 5)).toBe(84);
  });

  it("zero tax rate leaves the total unchanged", () => {
    const sub = subtotalOf([{ price: 50 }]);
    expect(totalOf(sub, 0, 0, 0)).toBe(50);
  });

  it("applies an automatic tier discount before tax (gold = 10%)", () => {
    const sub = subtotalOf([{ price: 100 }]);
    const tier = tierDiscountOf(sub, 10); // gold
    expect(tier).toBe(10);
    const net = netOf(sub, 0, 0, tier); // 90
    expect(net).toBe(90);
    expect(net + taxOf(net, 5)).toBe(94.5); // +5% VAT
  });

  it("stacks manual + tier + loyalty discounts without going negative", () => {
    const sub = subtotalOf([{ price: 100 }]);
    const tier = tierDiscountOf(sub, 15); // platinum -> 15
    const net = netOf(sub, 20, 1000, tier); // 100 - 20 - 15 - (loyalty capped) => 0
    expect(net).toBe(0);
  });
});

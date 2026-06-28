import { describe, expect, it } from "vitest";

function subtotalOf(items: { price: number; qty?: number }[]): number {
  return items.reduce((s, it) => s + Number(it.price) * Number(it.qty ?? 1), 0);
}

function packageSavings(servicesTotal: number, packagePrice: number): number {
  return Math.max(0, Math.round((servicesTotal - packagePrice) * 1000) / 1000);
}

describe("packages/bundles calculations", () => {
  it("package subtotal uses the bundle price sold in POS", () => {
    expect(subtotalOf([{ price: 18, qty: 2 }])).toBe(36);
  });

  it("computes visible package savings against included services total", () => {
    expect(packageSavings(25, 18)).toBe(7);
  });

  it("never shows negative savings", () => {
    expect(packageSavings(10, 12)).toBe(0);
  });
});

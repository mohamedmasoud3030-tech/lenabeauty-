import { describe, expect, it } from "vitest";
import { calculateCheckoutTotals, roundMoney, validateCheckoutContract } from "../domain/commerce";
import { validateCheckoutPayload } from "../application/dto";

describe("canonical financial behavior", () => {
  const basePayload = {
    customerId: "customer-1",
    employeeId: "employee-1",
    paymentMethod: "cash" as const,
    items: [{ type: "service" as const, serviceId: "service-1", qty: 1, price: 10 }],
  };

  it("rejects zero-priced, fractional-quantity, and untraceable lines", () => {
    expect(validateCheckoutContract({
      ...basePayload,
      items: [{ type: "service", serviceId: "service-1", qty: 1, price: 0 }],
    })).toContain("Item at slot 1 must have a positive finite price");

    expect(validateCheckoutContract({
      ...basePayload,
      items: [{ type: "product", productId: "product-1", qty: 1.5, price: 2 }],
    })).toContain("Item at slot 1 must have a positive whole quantity");

    expect(validateCheckoutPayload({
      ...basePayload,
      items: [{ type: "package", qty: 1, price: 20 }],
    }).some((message) => message.includes("catalog reference"))).toBe(true);
  });

  it("accepts a positive package line with required customer, employee, and payment method", () => {
    expect(validateCheckoutContract({
      ...basePayload,
      items: [{ type: "package", packageId: "package-1", qty: 2, price: 20 }],
    })).toEqual([]);
  });

  it("uses one formula for tier, whole loyalty points, gift card, tax, and total", () => {
    const result = calculateCheckoutTotals({
      items: [{ price: 40.125, qty: 2 }],
      manualDiscount: 5,
      tierPercent: 10,
      loyaltyPoints: 100,
      useLoyaltyPoints: true,
      giftCardBalance: 3.125,
      taxRate: 5,
    });

    expect(result).toEqual({
      subtotal: 80.25,
      manualDiscount: 5,
      tierDiscount: 8.025,
      loyaltyDiscount: 67,
      giftCardDiscount: 0.225,
      net: 0,
      tax: 0,
      total: 0,
    });
  });

  it("never consumes a fractional loyalty point and rounds OMR to three decimals", () => {
    const result = calculateCheckoutTotals({
      items: [{ price: 10.5555, qty: 1 }],
      manualDiscount: 0,
      tierPercent: 0,
      loyaltyPoints: 50,
      useLoyaltyPoints: true,
      giftCardBalance: 0,
      taxRate: 5,
    });

    expect(result.subtotal).toBe(10.556);
    expect(result.loyaltyDiscount).toBe(10);
    expect(result.net).toBe(0.556);
    expect(result.tax).toBe(0.028);
    expect(result.total).toBe(0.584);
    expect(roundMoney(1.2349)).toBe(1.235);
  });

  it("requires traceability fields before transport", () => {
    expect(validateCheckoutContract({ ...basePayload, employeeId: "" })).toContain("Employee details are missing");
    expect(validateCheckoutContract({ ...basePayload, customerId: "" })).toContain("Customer details are missing");
    expect(validateCheckoutContract({ ...basePayload, paymentMethod: "cash", discountAmount: Number.NaN }))
      .toContain("Discount must be a non-negative finite amount");
  });
});

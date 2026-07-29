import { describe, expect, it } from "vitest";
import { validateCheckoutPayload } from "../application/dto";

function computeGiftCardDiscount(args: {
  subtotal: number;
  manualDiscount: number;
  tierDiscount: number;
  loyaltyDiscount: number;
  giftCardBalance: number;
}) {
  const { subtotal, manualDiscount, tierDiscount, loyaltyDiscount, giftCardBalance } = args;
  return Math.max(0, Math.min(subtotal - manualDiscount - tierDiscount - loyaltyDiscount, giftCardBalance));
}

describe("gift card calculations", () => {
  it("caps gift card redemption at the remaining pre-tax balance", () => {
    expect(computeGiftCardDiscount({ subtotal: 100, manualDiscount: 10, tierDiscount: 5, loyaltyDiscount: 15, giftCardBalance: 1000 })).toBe(70);
  });

  it("returns zero when no balance remains after other discounts", () => {
    expect(computeGiftCardDiscount({ subtotal: 20, manualDiscount: 10, tierDiscount: 5, loyaltyDiscount: 5, giftCardBalance: 50 })).toBe(0);
  });

  it("checkout payload accepts optional gift card code", () => {
    const errors = validateCheckoutPayload({
      customerId: "c1",
      giftCardCode: "GC-100",
      paymentMethod: "cash",
      items: [{ type: "service", serviceId: "s1", qty: 1, price: 10 }],
    });
    expect(errors).toEqual([]);
  });
});

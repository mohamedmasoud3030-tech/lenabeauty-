import { describe, expect, it } from "vitest";
import { CustomerEntitlement } from "../domain/entities";
import {
  buildCustomerWallet,
  hasDuplicateRedemption,
  walletAvailableForCheckout,
} from "../domain/wallet";

function entitlement(partial: Partial<CustomerEntitlement>): CustomerEntitlement {
  return {
    id: "e-1",
    centerId: "c",
    kind: "GIFT_CARD",
    originalValue: 0,
    remainingValue: 0,
    status: "ACTIVE",
    legacyFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as CustomerEntitlement;
}

describe("LENA Wallet", () => {
  it("projects gift-card balance, rewards and deposit without merging them", () => {
    const wallet = buildCustomerWallet({
      entitlements: [
        entitlement({ id: "gc1", kind: "GIFT_CARD", remainingValue: 18, giftCardCode: "ABC123" }),
      ],
      loyaltyPoints: 420,
      depositAmount: 5,
    });
    expect(wallet.giftCardBalance).toBe(18);
    expect(wallet.rewardsPoints).toBe(420);
    expect(wallet.depositAmount).toBe(5);
    expect(wallet.giftCards).toHaveLength(1);
  });

  it("sums only usable gift-card entitlements", () => {
    const wallet = buildCustomerWallet({
      entitlements: [
        entitlement({ id: "gc1", kind: "GIFT_CARD", remainingValue: 10 }),
        entitlement({ id: "gc2", kind: "GIFT_CARD", remainingValue: 8 }),
        entitlement({ id: "gc3", kind: "GIFT_CARD", remainingValue: 50, status: "VOID" }),
      ],
      loyaltyPoints: 0,
    });
    expect(wallet.giftCardBalance).toBe(18);
    expect(wallet.giftCards).toHaveLength(2);
  });

  it("projects remaining package sessions per service", () => {
    const wallet = buildCustomerWallet({
      entitlements: [
        entitlement({
          id: "pkg1",
          kind: "PACKAGE",
          remainingValue: 60,
          instrumentName: "Facial × 5",
          units: [
            {
              id: "u1",
              centerId: "c",
              entitlementId: "pkg1",
              serviceId: "svc-facial",
              totalUnits: 5,
              usedUnits: 2,
              serviceName: "Facial",
              createdAt: new Date(),
            },
          ],
        }),
      ],
      loyaltyPoints: 0,
    });
    expect(wallet.packages).toHaveLength(1);
    expect(wallet.packages[0].remainingUnits).toBe(3);
  });

  it("only offers a package session against the matching service in the cart", () => {
    const wallet = buildCustomerWallet({
      entitlements: [
        entitlement({
          id: "pkg1",
          kind: "PACKAGE",
          remainingValue: 60,
          instrumentName: "Facial × 5",
          units: [
            { id: "u1", centerId: "c", entitlementId: "pkg1", serviceId: "svc-facial", totalUnits: 5, usedUnits: 0, serviceName: "Facial", createdAt: new Date() },
          ],
        }),
      ],
      loyaltyPoints: 100,
      depositAmount: 5,
    });
    const benefits = walletAvailableForCheckout(wallet, ["svc-nails"]);
    expect(benefits.some((b) => b.kind === "PACKAGE")).toBe(false);

    const withFacial = walletAvailableForCheckout(wallet, ["svc-facial"]);
    expect(withFacial.some((b) => b.kind === "PACKAGE")).toBe(true);
    expect(withFacial.some((b) => b.kind === "GIFT_CARD")).toBe(false);
    expect(withFacial.some((b) => b.kind === "REWARDS")).toBe(true);
    expect(withFacial.some((b) => b.kind === "DEPOSIT")).toBe(true);
  });

  it("guards against double redemption of the same entitlement", () => {
    expect(hasDuplicateRedemption(["e-1", "e-2"], "e-3")).toBe(false);
    expect(hasDuplicateRedemption(["e-1", "e-1"], "e-1")).toBe(true);
  });
});

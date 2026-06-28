import { describe, expect, it } from "vitest";

function chargedAmount(depositAmount: number, noShowFeeAmount: number, shouldCharge: boolean): number {
  if (!shouldCharge) return 0;
  return Math.max(depositAmount, noShowFeeAmount);
}

describe("no-show protection calculations", () => {
  it("charges the higher of deposit or no-show fee when protected", () => {
    expect(chargedAmount(10, 15, true)).toBe(15);
    expect(chargedAmount(20, 15, true)).toBe(20);
  });

  it("does not charge when staff disables fee collection", () => {
    expect(chargedAmount(10, 15, false)).toBe(0);
  });

  it("supports zero-value protection", () => {
    expect(chargedAmount(0, 0, true)).toBe(0);
  });
});

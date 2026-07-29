import { describe, expect, it } from "vitest";
import {
  LOYALTY_TIERS,
  getTierBySpend,
  getNextTier,
  spendToNextTier,
  tierProgress,
} from "../domain/loyalty";

describe("Loyalty tiers", () => {
  it("maps lifetime spend to the correct tier", () => {
    expect(getTierBySpend(0).id).toBe("bronze");
    expect(getTierBySpend(199).id).toBe("bronze");
    expect(getTierBySpend(200).id).toBe("silver");
    expect(getTierBySpend(499).id).toBe("silver");
    expect(getTierBySpend(500).id).toBe("gold");
    expect(getTierBySpend(1000).id).toBe("platinum");
    expect(getTierBySpend(99999).id).toBe("platinum");
  });

  it("handles invalid / negative spend safely", () => {
    expect(getTierBySpend(-50).id).toBe("bronze");
    expect(getTierBySpend(NaN).id).toBe("bronze");
  });

  it("tiers are ordered ascending and discounts increase", () => {
    for (let i = 1; i < LOYALTY_TIERS.length; i++) {
      expect(LOYALTY_TIERS[i].minSpend).toBeGreaterThan(LOYALTY_TIERS[i - 1].minSpend);
      expect(LOYALTY_TIERS[i].discountPercent).toBeGreaterThanOrEqual(LOYALTY_TIERS[i - 1].discountPercent);
    }
  });

  it("computes the next tier and remaining spend", () => {
    expect(getNextTier(0)?.id).toBe("silver");
    expect(spendToNextTier(0)).toBe(200);
    expect(spendToNextTier(150)).toBe(50);
    expect(getNextTier(1000)).toBeNull();
    expect(spendToNextTier(1200)).toBe(0);
  });

  it("computes progress toward the next tier", () => {
    expect(tierProgress(0)).toBe(0);          // bronze start
    expect(tierProgress(100)).toBeCloseTo(0.5); // halfway bronze->silver (0..200)
    expect(tierProgress(200)).toBe(0);          // silver start
    expect(tierProgress(1000)).toBe(1);         // platinum (top)
  });
});

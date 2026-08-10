import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatOMRAmount, OMR_FRACTION_DIGITS } from "../shared/money";

describe("OMR display precision", () => {
  it("always displays the three fractional digits used by the financial source", () => {
    expect(OMR_FRACTION_DIGITS).toBe(3);
    expect(formatOMRAmount(0)).toBe("0.000");
    expect(formatOMRAmount(1.2)).toBe("1.200");
    expect(formatOMRAmount(12.345)).toBe("12.345");
    expect(formatOMRAmount(-4.5)).toBe("-4.500");
  });

  it("rounds display-only excess precision without exposing negative zero", () => {
    expect(formatOMRAmount(1.2349)).toBe("1.235");
    expect(formatOMRAmount(-0.0001)).toBe("0.000");
  });

  it("fails closed for malformed transport values", () => {
    expect(formatOMRAmount(Number.NaN)).toBe("0.000");
    expect(formatOMRAmount(Number.POSITIVE_INFINITY)).toBe("0.000");
    expect(formatOMRAmount(undefined)).toBe("0.000");
  });

  it("is used by every targeted operational money surface", () => {
    for (const file of [
      "src/pages/PosInvoicesPage.tsx",
      "src/pages/DashboardPage.tsx",
      "src/pages/ReportsPage.tsx",
      "src/pages/ServicesPage.tsx",
      "src/pages/InventoryPage.tsx",
      "src/shared/components/InvoicePrintLayout.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).toContain("formatOMRAmount");
      expect(source, file).not.toContain("toFixed(2)");
    }
  });
});

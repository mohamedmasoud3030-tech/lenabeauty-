import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_REORDER_LEVEL, isLowStock, reorderLevelFor } from "../domain/inventory";

/**
 * The reorder warning is one rule, and this file holds it to that.
 *
 * Before: the dashboard, the inventory list and its counter honoured
 * `reorder_level` with a fallback of 5; the point of sale used a fixed 5; the
 * inventory report used a fixed 10; the forecast alert used a fixed 5 — and the
 * comparison was `<` in some places and `<=` in others. The same product could
 * therefore read "Low Stock" in the reports and healthy in the point of sale,
 * and a level typed on a product was ignored by three of the six screens.
 */

const CONSUMERS = [
  "src/pages/DashboardCompatPage.tsx",
  "src/pages/InventoryPage.tsx",
  "src/pages/pos/PosCatalogPanel.tsx",
  "src/pages/reports/InventoryReportSection.tsx",
  "src/infrastructure/supabase/repositories/engagement.ts",
];

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) found.push(path);
  }
  return found;
}

describe("the low-stock rule", () => {
  it("uses the level the owner set on the product", () => {
    expect(reorderLevelFor({ reorderLevel: 12 })).toBe(12);
    expect(isLowStock({ stockQuantity: 12, reorderLevel: 12 })).toBe(true);
    expect(isLowStock({ stockQuantity: 13, reorderLevel: 12 })).toBe(false);
  });

  it("falls back to the default when the product has no level of its own", () => {
    expect(DEFAULT_REORDER_LEVEL).toBe(5);
    // `reorder_level` is NOT NULL DEFAULT 0, so "not set" arrives as 0.
    for (const unset of [undefined, null, 0, -3, Number.NaN]) {
      expect(reorderLevelFor({ reorderLevel: unset }), String(unset)).toBe(DEFAULT_REORDER_LEVEL);
    }
    expect(isLowStock({ stockQuantity: 5 })).toBe(true);
    expect(isLowStock({ stockQuantity: 6 })).toBe(false);
  });

  it("warns when stock has REACHED the level, not only when it is below", () => {
    // The boundary is the point: `<` and `<=` used to disagree screen to screen.
    expect(isLowStock({ stockQuantity: 5, reorderLevel: 5 })).toBe(true);
    expect(isLowStock({ stockQuantity: 4, reorderLevel: 5 })).toBe(true);
    expect(isLowStock({ stockQuantity: 6, reorderLevel: 5 })).toBe(false);
  });

  it("does not warn about products that cannot run out", () => {
    // A product that does not track inventory sits at 0 by design; the point of
    // sale used to paint every one of them red.
    expect(isLowStock({ stockQuantity: 0, trackInventory: false })).toBe(false);
    // A disabled product is not a purchasing task either.
    expect(isLowStock({ stockQuantity: 0, isActive: false })).toBe(false);
  });

  it("survives missing and unusable quantities", () => {
    expect(isLowStock(undefined)).toBe(false);
    expect(isLowStock(null)).toBe(false);
    expect(isLowStock({ stockQuantity: Number.NaN })).toBe(true);
    expect(isLowStock({ stockQuantity: undefined })).toBe(true);
    // Numbers that arrive as strings from a JSON payload still compare.
    expect(isLowStock({ stockQuantity: "8" as unknown as number })).toBe(false);
  });

  it("is the only place the threshold and the comparison are written", () => {
    for (const path of CONSUMERS) {
      const source = readSource(path);
      expect(source, `${path} must use the shared rule`).toContain("isLowStock");
      // `reorderLevel ?? 0` seeds the edit form, where 0 means "not set"; a
      // non-zero fallback would be a second threshold hiding in a screen.
      expect(
        source,
        `${path} must not keep its own reorder threshold`,
      ).not.toMatch(/reorderLevel\s*\?\?\s*[1-9]\d*|reorder_level\s*[<>]=?\s*\d|(?:stockQuantity|quantity|stock)\s*[<>]=?\s*(?:5|10|20)\b/);
    }
  });

  it("leaves no comparison against a reorder level anywhere outside the rule", () => {
    const offenders: string[] = [];
    for (const path of sourceFiles(resolve(process.cwd(), "src"))) {
      if (path.endsWith("domain/inventory.ts") || path.includes("__tests__")) continue;
      const source = readFileSync(path, "utf8");
      if (/reorderLevel\s*[<>]=?|reorder_level\s*[<>]=?/.test(source)) {
        offenders.push(path.replace(resolve(process.cwd()) + "/", ""));
      }
    }
    expect(offenders).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = (name: string) => readFileSync(resolve(process.cwd(), "src/pages", name), "utf8");
const sidebar = readFileSync(resolve(process.cwd(), "src/ui/layout/Sidebar.tsx"), "utf8");
const globalSearch = readFileSync(resolve(process.cwd(), "src/shared/components/GlobalSearch.tsx"), "utf8");

describe("workforce route localization and discoverability", () => {
  it("keeps visible workforce copy in i18n instead of hard-coded Arabic", () => {
    for (const file of [
      "AttendancePage.tsx",
      "AdvancesPage.tsx",
      "PayrollPageEnhanced.tsx",
      "StaffAnalyticsPage.tsx",
    ]) {
      expect(page(file), file).not.toMatch(/[\u0600-\u06ff]/);
    }
  });

  it("exposes every supported workforce route in admin navigation and search", () => {
    for (const route of ["/attendance", "/advances", "/payroll", "/staff-analytics"]) {
      expect(sidebar).toContain(`to: "${route}"`);
      expect(globalSearch).toContain(`path: "${route}"`);
    }
  });

  it("bounds staff analytics to the selected month and matching payroll run", () => {
    const source = page("StaffAnalyticsPage.tsx");
    expect(source).toContain("useCases.attendance.list(range)");
    expect(source).toContain("useCases.advances.list(range)");
    expect(source).toContain("run.periodMonth.slice(0, 7) === selectedMonth");
    expect(source).toContain("[selectedMonth]");
  });
});

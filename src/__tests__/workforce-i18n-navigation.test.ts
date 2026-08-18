import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_DESTINATIONS } from "../app/navigation";

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
    // Sidebar and search now render from the shared navigation registry, so
    // the guarantee is asserted there: presence in the registry means presence
    // in BOTH surfaces, which is stronger than matching two literal lists.
    expect(sidebar).toContain("visibleDestinations");
    expect(globalSearch).toContain("NAV_DESTINATIONS");

    for (const route of ["/attendance", "/advances", "/payroll", "/staff-analytics"]) {
      const destination = NAV_DESTINATIONS.find((d) => d.path === route);
      expect(destination, `${route} must be a registered destination`).toBeDefined();
      expect(destination!.adminOnly, `${route} must stay admin-only`).toBe(true);
      // Grouped under Team, so it is discoverable rather than search-only.
      expect(destination!.group).toBe("team");
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

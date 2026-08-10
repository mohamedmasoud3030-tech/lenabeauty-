import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

const operationalSurfaces = [
  "src/pages/ServicesPage.tsx",
  "src/pages/PosInvoicesPage.tsx",
  "src/pages/AppointmentsPage.tsx",
  "src/pages/CustomersPage.tsx",
  "src/pages/InventoryPage.tsx",
  "src/pages/DashboardPage.tsx",
  "src/pages/ReportsPage.tsx",
  "src/pages/SettingsPage.tsx",
  "src/pages/BrandingSettingsPage.tsx",
  "src/pages/NotificationsSettingsPage.tsx",
  "src/pages/PaymentGatewaySettingsPage.tsx",
];

describe("Lena visual identity tokens", () => {
  it("defines one brand palette and four semantic statuses in both themes", () => {
    for (const token of ["--primary", "--secondary", "--success", "--warning", "--destructive", "--info"]) {
      expect(css.match(new RegExp(`${token}:`, "g"))?.length).toBeGreaterThanOrEqual(2);
    }
    expect(css).toContain("Same Lena violet/rose identity on deep plum surfaces");
    expect(css).not.toContain("Navy base");
  });

  it("keeps operational pages free of one-off Tailwind color palettes", () => {
    const rawPalette = /(?:bg|text|border|ring|shadow|from|via|to)-(?:blue|purple|pink|emerald|amber|sky|indigo|violet|cyan|orange|rose|red|green|yellow)-\d/;
    for (const file of operationalSurfaces) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(rawPalette);
    }
  });
});

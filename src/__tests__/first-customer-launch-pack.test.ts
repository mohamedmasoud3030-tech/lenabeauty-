import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("first customer launch pack", () => {
  it("keeps go-live readiness inside the canonical Settings owner", () => {
    const settings = read("src/pages/SettingsPage.tsx");
    expect(settings).toContain('"launch"');
    expect(settings).toContain("LaunchReadinessSection");
    expect(settings).toContain('tab === "launch"');
  });

  it("derives readiness from real application use cases instead of local flags", () => {
    const readiness = read("src/pages/settings/LaunchReadinessSection.tsx");
    expect(readiness).toContain("useCases.settings.get()");
    expect(readiness).toContain("useCases.services.list()");
    expect(readiness).toContain("useCases.employees.list()");
    expect(readiness).toContain("useCases.products.listFull()");
    expect(readiness).toContain("useCases.customers.list()");
    expect(readiness).toContain("useCases.appointments.list(");
    expect(readiness).toContain("useCases.reports.getSales(");
    expect(readiness).not.toContain("localStorage");
  });

  it("certifies the first sale from PAID invoice reporting rather than imported customer totals", () => {
    const readiness = read("src/pages/settings/LaunchReadinessSection.tsx");
    const reports = read("src/infrastructure/supabase/repositories/reports.ts");

    expect(readiness).toContain("firstSale: sales.length > 0");
    expect(readiness).not.toContain("customer.totalSpent");
    expect(reports).toContain(".eq('status', 'PAID')");
  });

  it("does not misrepresent operational export as a full financial restore", () => {
    const settings = read("src/pages/SettingsPage.tsx");
    const adapter = read("src/infrastructure/supabase/repositories/settings.ts");
    const launchPack = read("docs/FIRST_CUSTOMER_LAUNCH_PACK.md");

    expect(settings).toContain("It is not a database backup and cannot restore financial records.");
    expect(adapter).toContain("invoices/invoice_items are intentionally NOT restored");
    expect(launchPack).toContain("No claim that JSON export is a full financial/database backup.");
  });

  it("forbids bypassing production integrity controls during onboarding", () => {
    const launchPack = read("docs/FIRST_CUSTOMER_LAUNCH_PACK.md");
    expect(launchPack).toContain("No direct financial inserts or manual invoice fabrication.");
    expect(launchPack).toContain("No disabling RLS/RPC/auth controls");
    expect(launchPack).toContain("No destructive restore test against the live tenant.");
  });
});
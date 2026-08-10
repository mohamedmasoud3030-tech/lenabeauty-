import { describe, expect, it, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import i18n from "../i18n";

/**
 * Arabic-first guard: every t("...") key used by the QA-scope pages must exist
 * in the i18n dictionary (both languages). Found via live QA: POS toasts,
 * appointment actions and several dialogs rendered English keys in the Arabic
 * UI. This test prevents regressions.
 */
const QA_SCOPE_FILES = [
  "src/pages/AppointmentsPage.tsx",
  "src/pages/PosInvoicesPage.tsx",
  "src/pages/CustomersPage.tsx",
  "src/pages/ServicesPage.tsx",
  "src/pages/InventoryPage.tsx",
  "src/pages/ExpensesPage.tsx",
  "src/pages/EmployeesPage.tsx",
  "src/pages/PackagesPage.tsx",
  "src/pages/GiftCardsPage.tsx",
  "src/pages/ReportsPage.tsx",
  "src/pages/DashboardPage.tsx",
  "src/pages/LoginPage.tsx",
  "src/pages/SettingsPage.tsx",
  "src/ui/layout/Layout.tsx",
  "src/ui/layout/Sidebar.tsx",
  "src/shared/components/ScreenState.tsx",
  "src/shared/components/ListState.tsx",
  "src/shared/components/PageHeader.tsx",
  "src/shared/components/ConfirmDialog.tsx",
  "src/shared/components/InvoicePrintLayout.tsx",
  "src/shared/components/PageLoader.tsx",
];

function extractKeys(source: string): Set<string> {
  const keys = new Set<string>();
  const re = /\bt\("([^"]+)"\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) keys.add(m[1]);
  return keys;
}

describe("QA-scope i18n coverage (Arabic-first)", () => {
  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("every t() key used by QA-scope pages resolves in Arabic (not the raw key)", async () => {
    await i18n.changeLanguage("ar");

    const allKeys = new Set<string>();
    for (const file of QA_SCOPE_FILES) {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const k of extractKeys(src)) allKeys.add(k);
    }

    expect(allKeys.size).toBeGreaterThan(100);
    for (const k of allKeys) {
      expect(i18n.exists(k), `missing i18n key: ${k}`).toBe(true);
      const value = i18n.t(k);
      expect(value, `AR resolves to raw key: ${k}`).not.toBe(k);
      expect(value.trim(), `AR empty translation for: ${k}`).not.toBe("");
    }
  });

  it("QA-scope keys also resolve in English", async () => {
    await i18n.changeLanguage("en");

    for (const file of QA_SCOPE_FILES) {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const k of extractKeys(src)) {
        expect(i18n.t(k).trim(), `EN missing/empty for: ${k}`).not.toBe("");
      }
    }
  });
});

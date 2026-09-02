import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { repositoriesSource } from "./helpers/repositoriesSource";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260817000002_financial_reporting_repair.sql"),
  "utf8",
);
const inventory = JSON.parse(readFileSync(
  resolve(process.cwd(), "docs/database-contract/artifacts/schema-inventory.json"),
  "utf8",
));
const repositories = repositoriesSource();
const dashboardBlock = readFileSync(
  resolve(process.cwd(), "src/infrastructure/supabase/repositories/dashboard.ts"),
  "utf8",
);

describe("financial reporting repair", () => {
  it("defines pinned server-governed dashboard RPCs", () => {
    for (const name of [
      "get_dashboard_summary_v1",
      "get_dashboard_pnl_v1",
      "get_dashboard_revenue_entries_v1",
    ]) {
      const fn = inventory.functions.find((entry: any) => entry.name === name);
      expect(fn, `${name} exists`).toBeTruthy();
      expect(fn.security_definer).toBe(true);
      expect(fn.config).toContain("search_path=pg_catalog, public, app_private");
      expect(fn.definition).toContain("has_center_role");
      const clientGrant = inventory.function_acl.find((entry: any) =>
        entry.name === name && entry.grantee === "authenticated" && entry.privilege === "EXECUTE",
      );
      expect(clientGrant, `${name} has an exact authenticated grant`).toBeTruthy();
    }
  });

  it("excludes VAT and prepaid lines and includes governed redemptions", () => {
    expect(migration).toMatch(/inv\.total_amount\s*- COALESCE\(inv\.tax, 0\)/i);
    expect(migration).toMatch(/- COALESCE\(prepaid\.amount, 0\)/i);
    expect(migration).toMatch(/\+ COALESCE\(redeemed\.amount, inv\.gift_card_discount, 0\)/i);
    expect(migration).toMatch(/ii\.package_id IS NOT NULL OR ii\.gift_card_id IS NOT NULL/i);
    expect(migration).toMatch(/el\.entry_type = 'REDEEM'/i);
  });

  it("returns financial capability only from the server role check", () => {
    const summary = inventory.functions.find((entry: any) => entry.name === "get_dashboard_summary_v1");
    expect(summary.definition).toContain("v_is_admin := app_private.has_center_role");
    expect(summary.definition).toContain("'can_view_revenue', v_is_admin");
    expect(summary.definition).toContain("CASE WHEN v_is_admin THEN v_earned ELSE 0 END");
  });

  it("uses the governed RPCs instead of browser-side salary/P&L aggregation", () => {
    expect(repositories).toContain("rpc('get_dashboard_summary_v1'");
    expect(repositories).toContain("rpc('get_dashboard_pnl_v1'");
    expect(repositories).toContain("rpc('get_dashboard_revenue_entries_v1'");

    expect(dashboardBlock).not.toContain("from('employees')");
    expect(dashboardBlock).not.toContain("from('expenses')");
    expect(dashboardBlock).not.toContain("from('invoices')");
  });
});

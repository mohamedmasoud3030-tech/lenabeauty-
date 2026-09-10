import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

const commissionEngine = readMigration("20260912100000_commission_engine.sql");

describe("commission engine migration (20260912100000)", () => {
  it("snapshots per-run commissions on payroll line items with a non-negative constraint", () => {
    expect(commissionEngine).toContain("ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,3) NOT NULL DEFAULT 0");
    expect(commissionEngine).toContain("payroll_line_commission_non_negative");
    expect(commissionEngine).toContain("CHECK (commission_amount >= 0)");
  });

  it("derives commission from PAID invoices attributed to the checkout employee", () => {
    expect(commissionEngine).toContain("AND inv.status = 'PAID'");
    expect(commissionEngine).toContain("AND inv.employee_id IS NOT NULL");
    expect(commissionEngine).toContain("COALESCE(employee.commission_percentage, 0) / 100.0");
    expect(commissionEngine).toContain("earned_per_invoice");
  });

  it("uses the same earned-revenue definition as the PnL (prepaid deferred until redemption)", () => {
    // Payroll run and dashboard PnL must not be able to disagree: the same
    // netting expression (tax removed, prepaid sales deferred, redemptions
    // recognized) appears in both computations.
    const normalized = commissionEngine.replace(/\s+/g, " ");
    const earnedBlock = "- COALESCE(prepaid.amount, 0) + COALESCE(redeemed.amount, inv.gift_card_discount, 0),";
    const occurrences = normalized.split(earnedBlock).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2); // once in payroll, once in PnL
  });

  it("pays base + commission − advances and keeps the run period-unique", () => {
    expect(commissionEngine).toContain("round(greatest(");
    expect(commissionEngine).toContain("payroll_period_already_exists");
  });

  it("stops reading the dead legacy snapshot column in PnL", () => {
    const pnlStart = commissionEngine.indexOf("CREATE OR REPLACE FUNCTION public.get_dashboard_pnl_v1");
    const pnlEnd = commissionEngine.indexOf("$$;", pnlStart);
    const pnlBody = commissionEngine.slice(pnlStart, pnlEnd);
    expect(pnlBody).not.toContain("month_commission_total");
    expect(pnlBody).toContain("earned_per_invoice");
  });

  it("keeps both RPC signatures unchanged and re-asserts authenticated-only grants", () => {
    expect(commissionEngine).toContain("public.create_payroll_run_v1(\n  p_center_id UUID,\n  p_period_month TEXT,\n  p_notes TEXT DEFAULT NULL\n)");
    expect(commissionEngine).toContain("public.get_dashboard_pnl_v1(\n  p_center_id UUID,\n  p_from TIMESTAMPTZ,\n  p_to TIMESTAMPTZ\n)");
    expect(commissionEngine).toContain("REVOKE ALL ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) FROM PUBLIC, anon");
    expect(commissionEngine).toContain("REVOKE ALL ON FUNCTION public.get_dashboard_pnl_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon");
  });

  it("leaves the legacy employees.month_commission_total column in place (additive policy)", () => {
    expect(commissionEngine).not.toContain("DROP COLUMN");
  });
});

describe("commission engine frontend contract", () => {
  it("exposes commissionAmount on the PayrollLineItem entity and mapper", () => {
    const entities = readFileSync(resolve(process.cwd(), "src/domain/entities/index.ts"), "utf8");
    expect(entities).toContain("commissionAmount: number;");
    const mappers = readFileSync(resolve(process.cwd(), "src/infrastructure/supabase/mappers.ts"), "utf8");
    expect(mappers).toContain("commissionAmount: Number(row.commission_amount) || 0");
  });

  it("surfaces the commission column on the payroll screen and percent field on employees", () => {
    const payroll = readFileSync(resolve(process.cwd(), "src/pages/PayrollPageEnhanced.tsx"), "utf8");
    expect(payroll).toContain('t("Commission")');
    expect(payroll).toContain("line.commissionAmount");
    const employees = readFileSync(resolve(process.cwd(), "src/pages/EmployeesPage.tsx"), "utf8");
    expect(employees).toContain('t("Commission (%)")');
    // the legacy snapshot stays un-mutable from the UI
    expect(employees).toContain("delete payload.monthCommissionTotal");
  });
});

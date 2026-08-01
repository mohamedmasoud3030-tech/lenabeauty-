import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260628000016_validation_constraints.sql"), "utf8");

describe("validation-constraints migration", () => {
  it("adds the product reorder level column idempotently", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 0");
  });

  it("adds center-scoped branding columns idempotently", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS display_name TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS display_name_ar TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS brand_primary_color TEXT");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS brand_logo_base64 TEXT");
  });

  it("enforces non-negative monetary values where negative is never valid", () => {
    expect(sql).toContain("services_price_non_negative");
    expect(sql).toContain("products_price_non_negative");
    expect(sql).toContain("products_cost_non_negative");
    expect(sql).toContain("products_stock_non_negative");
    expect(sql).toContain("products_reorder_level_non_negative");
    expect(sql).toContain("employees_salary_non_negative");
    expect(sql).toContain("employees_base_salary_non_negative");
    expect(sql).toContain("expenses_amount_non_negative");
    expect(sql).toContain("appointments_deposit_non_negative");
    expect(sql).toContain("advances_amount_non_negative");
    expect(sql).toContain("payroll_net_salary_non_negative");
    expect(sql).toContain("invoices_total_non_negative");
  });

  it("bounds percentages and service duration", () => {
    expect(sql).toContain("employees_commission_percent");
    expect(sql).toContain("commission_percentage >= 0 AND commission_percentage <= 100");
    expect(sql).toContain("center_settings_tax_rate_range");
    expect(sql).toContain("tax_rate >= 0 AND tax_rate <= 100");
    expect(sql).toContain("services_duration_positive");
    expect(sql).toContain("duration_minutes > 0");
  });

  it("does NOT constrain accounting/signed-ledger amounts as non-negative", () => {
    // Signed ledger values (refunds/adjustments) live in journal entries and
    // must NOT be force-non-negative here.
    expect(sql).not.toMatch(/ADD CONSTRAINT[^;]*journal_entry[^;]*amount/i);
    expect(sql).not.toMatch(/journal_entry.*amount.*non_negative/i);
  });

  it("is idempotent (uses EXCEPTION WHEN duplicate_object)", () => {
    expect((sql.match(/duplicate_object/g) || []).length).toBeGreaterThan(5);
  });
});

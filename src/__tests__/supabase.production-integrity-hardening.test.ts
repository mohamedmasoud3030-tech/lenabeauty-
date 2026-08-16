import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260816000001_production_integrity_hardening.sql"),
  "utf8",
);

const checkoutSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260816000002_checkout_idempotency.sql"),
  "utf8",
);

describe("production integrity hardening migration", () => {
  it("stores governed center roles and gates all payroll surfaces to ADMIN", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS role TEXT/i);
    expect(sql).toMatch(/CHECK \(role IN \('ADMIN', 'MANAGER', 'STAFF'\)\)/i);
    expect(sql).toMatch(/FUNCTION app_private\.has_center_role[\s\S]*?SECURITY DEFINER/i);

    for (const policy of ["attendance_admin", "advances_admin", "payroll_runs_admin", "payroll_lines_admin"]) {
      expect(sql).toContain(`CREATE POLICY ${policy}`);
    }
    expect(sql.match(/has_center_role\(center_id, ARRAY\['ADMIN'\]\)/g)).toHaveLength(8);
  });

  it("validates tenant-scoped references and removes ambiguous simple foreign keys", () => {
    for (const constraint of [
      "attendance_employee_center_fk",
      "advances_employee_center_fk",
      "payroll_lines_run_center_fk",
      "payroll_lines_employee_center_fk",
      "services_category_center_fk",
      "payments_invoice_center_fk",
    ]) {
      expect(sql).toContain(`VALIDATE CONSTRAINT ${constraint}`);
    }
    expect(sql).toContain("advance_payroll_run_center_mismatch");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey");
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS services_category_fk");
  });

  it("does not expose internal trigger routines to client roles", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION app_private\.maintain_entitlement_balance_v1\(\) FROM PUBLIC, anon, authenticated/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION app_private\.enforce_advance_payroll_center_v1\(\) FROM PUBLIC, anon, authenticated/i);
  });
});

describe("checkout idempotency migration", () => {
  it("serializes a center/request key and returns the committed result on retry", () => {
    expect(checkoutSql).toMatch(/PRIMARY KEY \(center_id, request_id\)/i);
    expect(checkoutSql).toMatch(/ON CONFLICT \(center_id, request_id\) DO NOTHING/i);
    expect(checkoutSql).toMatch(/FOR UPDATE/i);
    expect(checkoutSql).toMatch(/IF v_result IS NOT NULL THEN\s+RETURN v_result/i);
    expect(checkoutSql).toContain("v_result := public.process_checkout_v1(");
  });

  it("keeps idempotency records private and grants only the wrapper", () => {
    expect(checkoutSql).toMatch(/REVOKE ALL ON public\.checkout_idempotency FROM PUBLIC, anon, authenticated/i);
    expect(checkoutSql).toMatch(/REVOKE ALL ON FUNCTION public\.process_checkout_v1[\s\S]*?FROM PUBLIC, anon, authenticated/i);
    expect(checkoutSql).toMatch(/SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, public, app_private/i);
    expect(checkoutSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.process_checkout_idempotent_v1/i);
  });
});

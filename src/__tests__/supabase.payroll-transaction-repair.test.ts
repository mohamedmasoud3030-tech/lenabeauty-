import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260817000003_payroll_transaction_repair.sql"),
  "utf8",
);
const inventory = JSON.parse(readFileSync(
  resolve(process.cwd(), "docs/database-contract/artifacts/schema-inventory.json"),
  "utf8",
));
const workforce = readFileSync(
  resolve(process.cwd(), "src/infrastructure/supabase/repositories/workforce.ts"),
  "utf8",
);

describe("transactional payroll repair", () => {
  it("creates and deletes payroll runs through ADMIN-only pinned RPCs", () => {
    for (const name of ["create_payroll_run_v1", "delete_payroll_run_v1"]) {
      const fn = inventory.functions.find((entry: any) => entry.name === name);
      expect(fn, `${name} exists`).toBeTruthy();
      expect(fn.security_definer).toBe(true);
      expect(fn.config).toContain("search_path=pg_catalog, public, app_private");
      expect(fn.definition).toContain("has_center_role");
      expect(fn.definition).toContain("ADMIN");
      expect(inventory.function_acl.some((entry: any) =>
        entry.name === name && entry.grantee === "authenticated" && entry.privilege === "EXECUTE",
      )).toBe(true);
    }
  });

  it("keeps run, line and advance mutations inside one database function", () => {
    const createFn = inventory.functions.find((entry: any) => entry.name === "create_payroll_run_v1").definition;
    expect(createFn).toContain("INSERT INTO public.payroll_runs");
    expect(createFn).toContain("INSERT INTO public.payroll_line_items");
    expect(createFn).toContain("UPDATE public.employee_advances");
    expect(createFn).toContain("status = 'DEDUCTED'");
    expect(createFn).toMatch(/greatest\([\s\S]*base_salary[\s\S]*advance\.amount[\s\S]*0/i);
    expect(createFn).toContain("invalid_payroll_period");
  });

  it("releases advances and deletes the run atomically", () => {
    const deleteFn = inventory.functions.find((entry: any) => entry.name === "delete_payroll_run_v1").definition;
    expect(deleteFn).toContain("FOR UPDATE");
    expect(deleteFn).toContain("status = 'APPROVED'");
    expect(deleteFn).toContain("deducted_in_run_id = NULL");
    expect(deleteFn).toContain("DELETE FROM public.payroll_runs");
  });

  it("revokes direct payroll table writes that could bypass advance reconciliation", () => {
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.payroll_runs FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.payroll_line_items FROM PUBLIC, anon, authenticated/i);
    expect(migration).toMatch(/GRANT SELECT ON public\.payroll_runs, public\.payroll_line_items TO authenticated/i);
  });

  it("removes the browser-side multi-request payroll mutation sequence", () => {
    const block = workforce.slice(workforce.indexOf("class SupabasePayrollAdapter"));
    expect(block).toContain("rpc('create_payroll_run_v1'");
    expect(block).toContain("rpc('delete_payroll_run_v1'");
    expect(block).not.toContain(".insert(lineRows)");
    expect(block).not.toContain("deductedIds");
  });

  it("does not invent an unapproved commission formula", () => {
    expect(migration).not.toContain("commission_percentage *");
    expect(migration).toContain("Commission calculation is intentionally not invented");
  });
});

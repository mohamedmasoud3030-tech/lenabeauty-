import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

describe("Payroll / service-execution migration (2026-08-13)", () => {
  it("introduces role helpers and ADMIN/MANAGER write policies for staff operations", () => {
    const sql = readMigration("20260813000001_payroll_rls_and_roles.sql");
    expect(sql).toContain("app_private.has_center_role");
    expect(sql).toContain("raw_user_meta_data ->> 'role'");
    expect(sql).toContain("attendance_manager_write");
    expect(sql).toContain("advances_manager_write");
    expect(sql).toContain("payroll_runs_manager_write");
    expect(sql).toContain("payroll_lines_manager_write");
    expect(sql).not.toContain("FOR ALL USING (app_private.is_center_member(center_id))");
  });

  it("replaces the multi-step payroll flow with atomic RPCs and a commission ledger", () => {
    const sql = readMigration("20260813000002_commission_and_atomic_payroll.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.commission_ledger");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_payroll_run_v1");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.delete_payroll_run_v1");
    expect(sql).toContain("status = 'DEDUCTED'");
    expect(sql).toContain("commission_amount");
    expect(sql).toContain("tips_amount");
    expect(sql).toContain("DROP INDEX IF EXISTS public.idx_payments_one_success_per_invoice");
  });

  it("defines the service-execution RPC linking appointment, checkout, commission and BOM", () => {
    const sql = readMigration("20260813000003_checkout_v2_and_service_execution.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.process_checkout_v2");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.complete_appointment_v1");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.service_bom_items");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.service_material_usage");
    expect(sql).toContain("p_payments");
    expect(sql).toContain("payments_do_not_cover_total");
    expect(sql).toContain("accrue_invoice_commission_v1");
    expect(sql).toContain("SET status = 'COMPLETED'");
  });

  it("defines spa resource booking with an exclusion constraint against double-booking", () => {
    const sql = readMigration("20260813000004_spa_resource_booking.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.resources");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.resource_bookings");
    expect(sql).toContain("EXCLUDE USING gist");
    expect(sql).toContain("resource_bookings_no_active_overlap");
    expect(sql).toContain("buffer_minutes");
    expect(sql).toContain("reserve_resource_v1");
    expect(sql).toContain("release_resource_v1");
  });
});

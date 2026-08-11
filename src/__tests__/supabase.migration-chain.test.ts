import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

describe("canonical Supabase migration chain", () => {
  it("does not let the retired legacy RLS step block a clean bootstrap", () => {
    const legacy = readMigration("20260623000002_enable_rls_and_policies.sql");
    expect(legacy).not.toContain("WHERE user_id = auth.uid()");
    expect(legacy).toContain("20260628000001_enable_rls.sql");
  });

  it("keeps profile_id as the membership identity in the canonical RLS step", () => {
    const initial = readMigration("20260623000001_initial_schema.sql");
    const rls = readMigration("20260628000001_enable_rls.sql");

    expect(initial).toContain("profile_id UUID NOT NULL");
    expect(rls).toContain("WHERE profile_id = auth.uid()");
    expect(rls).not.toContain("WHERE user_id = auth.uid()");
  });

  it("keeps customer creation compatible with the required referral code", () => {
    const advanced = readMigration("20260628000012_customer_experience_forecasting_accounting_advanced.sql");

    expect(advanced).toContain("ALTER COLUMN referral_code SET NOT NULL");
    expect(advanced).toContain("ALTER COLUMN referral_code SET DEFAULT");
  });

  it("adds the checkout employee reference before the checkout RPC", () => {
    const checkout = readMigration("20260628000003_checkout_rpc.sql");

    expect(checkout).toContain("ADD COLUMN IF NOT EXISTS employee_id UUID");
    expect(checkout.indexOf("ADD COLUMN IF NOT EXISTS employee_id UUID")).toBeLessThan(
      checkout.indexOf("CREATE OR REPLACE FUNCTION public.process_checkout_v1"),
    );
  });

  it("removes anonymous execution from privileged delivery RPCs", () => {
    const hardening = readMigration("20260809000001_delivery_security_hardening.sql");

    expect(hardening).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC");
    expect(hardening).toContain("REVOKE ALL ON FUNCTION %s FROM anon");
    expect(hardening).toContain("GRANT EXECUTE ON FUNCTION %s TO authenticated");
    expect(hardening).toContain("SET search_path TO pg_catalog, public, app_private");
  });

  it("includes the phase-4 security hardening migration as the chain tail", () => {
    const hardening = readMigration("20260810000005_security_hardening_auth.sql");

    expect(hardening).toContain("REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public      FROM PUBLIC");
    expect(hardening).toContain("center_assets_member_select");
    expect(hardening).toContain("password_hibp_enabled = true");
    expect(hardening).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
  });

  it("keeps every canonical migration file present and lexically ordered", () => {
    const canonical = [
      "20260623000001_initial_schema.sql",
      "20260623000002_enable_rls_and_policies.sql",
      "20260628000001_enable_rls.sql",
      "20260628000002_admin_bootstrap.sql",
      "20260628000003_checkout_rpc.sql",
      "20260628000004_vat_support.sql",
      "20260628000005_tier_discount.sql",
      "20260628000006_public_booking.sql",
      "20260628000007_gift_cards.sql",
      "20260628000008_packages_bundles.sql",
      "20260628000009_no_show_protection.sql",
      "20260628000010_notifications_payment_gateway.sql",
      "20260628000011_client_portal.sql",
      "20260628000012_customer_experience_forecasting_accounting_advanced.sql",
      "20260628000013_booking_reschedule_cancel.sql",
      "20260628000014_client_portal_lockout.sql",
      "20260628000015_attendance_advances_payroll.sql",
      "20260628000016_validation_constraints.sql",
      "20260809000001_delivery_security_hardening.sql",
      "20260810000001_fix_invoice_items_packages.sql",
      "20260810000002_operational_data_integrity.sql",
      "20260810000003_appointment_overlap_integrity.sql",
      "20260810000004_btree_gist_extension_schema.sql",
      "20260810000005_security_hardening_auth.sql",
    ];
    const present = readdirSync(resolve(process.cwd(), "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    for (const name of canonical) {
      expect(present).toContain(name);
    }
    expect([...canonical].sort()).toEqual(canonical);
  });
});

import { readFileSync } from "node:fs";
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
});

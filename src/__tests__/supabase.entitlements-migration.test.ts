import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260811004000_financial_entitlements.sql"),
  "utf8",
);
const securityTest = readFileSync(
  resolve(process.cwd(), "supabase/tests/20260810000005_security_hardening.sql"),
  "utf8",
);

describe("financial entitlements migration (gift cards + packages)", () => {
  it("creates normalized entitlement tables with center/customer ownership", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.customer_entitlements");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.package_entitlement_units");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.entitlement_ledger");
    expect(migration).toContain("UUID NOT NULL REFERENCES public.centers(id)");
    expect(migration).toContain("customer_entitlements_kind_instrument_match");
    expect(migration).toContain("customer_entitlements_owner_valid");
    expect(migration).toContain("source_invoice_id UUID REFERENCES public.invoices(id)");
  });

  it("keeps an immutable append-only ledger with OMR-safe signed entries", () => {
    expect(migration).toContain("entry_type IN ('ISSUE', 'FUND', 'REDEEM', 'REFUND', 'ADJUSTMENT',");
    expect(migration).toContain("'EXPIRY', 'VOID')");
    expect(migration).toContain("entitlement_ledger_amount_sign");
    expect(migration).toContain("NUMERIC(12,3)");
    expect(migration).toContain("maintain_entitlement_balance_v1");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.entitlement_ledger FROM anon, authenticated");
    // No UPDATE/DELETE policies: the ledger is append-only.
    expect(migration).not.toContain("entitlement_ledger_member_insert");
  });

  it("derives every balance from the ledger — never a UI-written number", () => {
    expect(migration).toContain("v_balance := round(v_balance + CASE NEW.entry_type");
    expect(migration).toContain("UPDATE public.customer_entitlements ce");
    expect(migration).toContain("SET remaining_value = v_balance");
    expect(migration).toContain("v_refund_total := v_refund_total + CASE WHEN NEW.entry_type = 'REFUND'");
    expect(migration).toContain("current_balance = v_balance"); // gift_cards mirror
    expect(migration).toContain("entitlement_insufficient_balance");
  });

  it("protects idempotency: one ISSUE per entitlement, one REDEEM per invoice", () => {
    expect(migration).toContain("idx_entitlement_ledger_one_issue");
    expect(migration).toContain("idx_entitlement_ledger_one_redeem_per_invoice");
    expect(migration).toContain("entitlement_already_redeemed_on_invoice");
  });

  it("extends the canonical atomic checkout with entitlements and gift-card sales", () => {
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.process_checkout_v1");
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB);");
    expect(migration).toContain("p_entitlement_redemptions JSONB DEFAULT NULL");
    expect(migration).toContain("v_ent_units := NULL;");
    expect(migration).toContain("'gift_card'"); // new line type
    expect(migration).toContain("gift_card_code_already_exists");
    expect(migration).toContain("INSERT INTO public.entitlement_ledger");
    expect(migration).toContain("'Gift card sold at checkout'");
    expect(migration).toContain("'Package sold at checkout'");
    expect(migration).toContain("package_insufficient_units");
    expect(migration).toContain("entitlement_customer_mismatch");
    expect(migration).toContain("entitlement_expired");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB) TO authenticated");
  });

  it("books entitlement redemptions separately from discounts on invoices", () => {
    expect(migration).toContain("entitlement_redemption NUMERIC(12,3) NOT NULL DEFAULT 0");
    expect(migration).toContain("invoices_paid_totals_consistent");
    expect(migration).toContain("gift_card_discount - entitlement_redemption");
    expect(migration).toContain("invoice_items_one_catalog_reference");
    expect(migration).toContain("('service', 'product', 'package', 'gift_card')");
  });

  it("provides governed refund/void/expiry RPCs with actor + reason", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.refund_entitlement_v1");
    expect(migration).toContain("p_reason TEXT");
    expect(migration).toContain("p_actor_employee_id UUID");
    expect(migration).toContain("entitlement_refund_exceeds_remaining");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.void_entitlement_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.expire_entitlement_v1");
    for (const fn of ["refund_entitlement_v1", "void_entitlement_v1", "expire_entitlement_v1"]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
  });

  it("does NOT auto-recognize breakage — expiry is a reserved governed hook", () => {
    expect(migration).toContain("breakage NOT recognized");
    expect(migration).toContain("breakage is NOT");
    expect(migration).toContain("(entry_type IN ('VOID', 'EXPIRY') AND amount = 0)");
    expect(migration).toContain("entitlement_not_yet_expired");
    // No scheduled job / no automatic recognition anywhere.
    expect(migration).not.toContain("cron");
    expect(migration).not.toContain("pg_cron");
  });

  it("closes direct writes to gift-card balances and marks legacy data explicitly", () => {
    expect(migration).toContain("DROP POLICY IF EXISTS gift_cards_update_member ON public.gift_cards");
    expect(migration).toContain("DROP POLICY IF EXISTS gift_card_transactions_insert_member");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.gift_cards FROM anon, authenticated");
    expect(migration).toContain("legacy_flag      BOOLEAN NOT NULL DEFAULT false");
    expect(migration).toContain("Legacy opening balance");
    expect(migration).toContain("issue_gift_card_v1_deprecated");
    // Legacy backfill never fabricates the original sale or prior redemptions.
    expect(migration).toContain("original sale and prior redemptions were not recorded in this ledger");
  });

  it("is additive and does not rewrite historical financial rows", () => {
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("DELETE FROM public.invoices");
    expect(migration).not.toContain("UPDATE public.invoices");
  });
});

describe("live security test stays aligned with the current checkout RPC signature", () => {
  it("checks the appointment-aware checkout and the governed entitlement RPCs", () => {
    expect(securityTest).toContain("'public.process_checkout_idempotent_v1(uuid, uuid, uuid, uuid, text, numeric, boolean, jsonb, text, jsonb, uuid)'");
    expect(securityTest).toContain("'public.refund_entitlement_v1(uuid, numeric, text, uuid)'");
    expect(securityTest).toContain("'public.void_entitlement_v1(uuid, text, uuid)'");
    expect(securityTest).toContain("'public.expire_entitlement_v1(uuid, text, uuid)'");
  });
});

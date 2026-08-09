import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

const initialSchema = readMigration("20260623000001_initial_schema.sql");
const checkoutRpc = readMigration("20260628000003_checkout_rpc.sql");
const packagesBundles = readMigration("20260628000008_packages_bundles.sql");
const deliveryHardening = readMigration("20260809000001_delivery_security_hardening.sql");
const canonicalRls = readMigration("20260628000001_enable_rls.sql");

describe("canonical checkout SQL chain (supabase/migrations)", () => {
  it("keeps the checkout RPC out of the initial schema", () => {
    expect(initialSchema).not.toContain("process_checkout_v1");
  });

  it("creates the invoice tables required by checkout, print, reports, and dashboard reads", () => {
    expect(initialSchema).toContain("CREATE TABLE IF NOT EXISTS invoices");
    expect(initialSchema).toContain("CREATE TABLE IF NOT EXISTS invoice_items");
    expect(initialSchema).toContain("center_id           UUID NOT NULL REFERENCES centers(id)");
    expect(initialSchema).toContain("customer_id         UUID NOT NULL REFERENCES customers(id)");
    expect(initialSchema).toContain("invoice_id UUID NOT NULL REFERENCES invoices(id)");
    expect(initialSchema).toContain("payment_method      TEXT NOT NULL DEFAULT 'CASH'");
  });

  it("defines RLS boundaries that scope member reads and writes through the tenant policies", () => {
    expect(canonicalRls).toContain("ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY");
    expect(canonicalRls).toContain("CREATE POLICY invoices_tenant ON invoices");
    expect(canonicalRls).toContain("center_id = ANY (app_private.user_center_ids())");
    expect(canonicalRls).toContain("CREATE POLICY invoice_items_tenant ON invoice_items");
    expect(canonicalRls).toContain("WHERE i.id = invoice_items.invoice_id");
  });

  it("defines a hardened process_checkout_v1 RPC with center authorization and stock deduction", () => {
    expect(checkoutRpc).toContain("CREATE OR REPLACE FUNCTION public.process_checkout_v1");
    expect(checkoutRpc).toContain("SECURITY DEFINER");
    expect(checkoutRpc).toContain("SET search_path");
    expect(checkoutRpc).toContain("app_private.has_center_role");
    expect(checkoutRpc).toContain("jsonb_array_elements(p_items)");
    expect(checkoutRpc).toContain("FOR UPDATE");
    expect(checkoutRpc).toContain("p.stock_quantity >= v_item_qty");
    expect(checkoutRpc).toContain("SET stock_quantity = p.stock_quantity - v_item_qty::INTEGER");
  });

  it("final delivery grants EXECUTE only to authenticated, never PUBLIC or anon", () => {
    expect(packagesBundles).toContain(
      "GRANT EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) TO authenticated",
    );
    expect(deliveryHardening).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC");
    expect(deliveryHardening).toContain("REVOKE ALL ON FUNCTION %s FROM anon");
    expect(deliveryHardening).toContain("GRANT EXECUTE ON FUNCTION %s TO authenticated");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

const fix = readMigration("20260810000001_fix_invoice_items_packages.sql");
const initial = readMigration("20260623000001_initial_schema.sql");
const packagesBundles = readMigration("20260628000008_packages_bundles.sql");

describe("invoice_items package fix migration", () => {
  it("adds a nullable package_id FK on invoice_items", () => {
    expect(fix).toContain("ALTER TABLE public.invoice_items");
    expect(fix).toContain("ADD COLUMN IF NOT EXISTS package_id UUID");
    expect(fix).toContain("REFERENCES public.service_packages(id) ON DELETE SET NULL");
    // package_id must be nullable — legacy service/product rows stay valid
    expect(fix).not.toContain("package_id UUID NOT NULL");
  });

  it("keeps the existing invoice_items columns intact", () => {
    expect(initial).toContain("CREATE TABLE IF NOT EXISTS invoice_items");
    expect(initial).toContain("service_id UUID REFERENCES services(id)");
    expect(initial).toContain("product_id UUID REFERENCES products(id)");
  });

  it("rewrites process_checkout_v1 to persist ONE row per package line with its real price", () => {
    expect(fix).toContain("CREATE OR REPLACE FUNCTION public.process_checkout_v1");
    // No more zero-priced expansion rows for packages
    expect(fix).not.toContain("INSERT INTO public.invoice_items (invoice_id, service_id, product_id, price, quantity)");
    expect(fix).toContain(
      "INSERT INTO public.invoice_items (invoice_id, service_id, product_id, package_id, price, quantity)",
    );
    expect(fix).toContain("VALUES (v_invoice_id, v_service_id, v_product_id, v_package_id, v_item_price, v_item_qty::INTEGER)");
    // Per-line state reset prevents leaking a previous line's service id
    expect(fix).toContain("v_service_id := NULL;");
    expect(fix).toContain("v_product_id := NULL;");
    expect(fix).toContain("v_package_id := NULL;");
  });

  it("preserves the pricing/stock/loyalty semantics of the checkout flow", () => {
    expect(fix).toContain("v_subtotal := v_subtotal + (v_item_price * v_item_qty)");
    expect(fix).toContain("p.stock_quantity >= v_item_qty");
    expect(fix).toContain("Insufficient product stock");
    expect(fix).toContain("v_earned_points := FLOOR(GREATEST(v_total - v_tax_amount, 0.000))");
    expect(fix).toContain("'gift_card_redeemed', v_gift_card_discount");
  });

  it("grants EXECUTE only to authenticated (never PUBLIC/anon)", () => {
    expect(fix).toContain("REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) FROM PUBLIC");
    expect(fix).toContain("REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) FROM anon");
    expect(fix).toContain("GRANT EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) TO authenticated");
  });

  it("does not regress the package authorization check", () => {
    expect(packagesBundles).toContain("Package is not available for this center");
    expect(fix).toContain("Package is not available for this center");
  });
});

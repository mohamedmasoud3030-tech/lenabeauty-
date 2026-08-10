import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810000002_operational_data_integrity.sql"),
  "utf8",
);
const seed = readFileSync(
  resolve(process.cwd(), "supabase/seeds/20260810_lena_service_catalog_demo.sql"),
  "utf8",
);
const rollback = readFileSync(
  resolve(process.cwd(), "supabase/rollbacks/20260810000002_operational_data_integrity.md"),
  "utf8",
);

describe("phase 3 operational integrity migration", () => {
  it("adds explicit service categories, pricing modes, and positive sell prices", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.service_categories");
    expect(migration).toContain("services_category_fk");
    expect(migration).toContain("pricing_mode IN ('FIXED', 'STARTING_FROM')");
    expect(migration).toContain("services_sell_price_positive");
    expect(migration).toContain("service_packages_sell_price_positive");
  });

  it("persists one positive immutable line and an auditable payment in the same checkout", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.payments");
    expect(migration).toContain("item_type, item_name, price, quantity");
    expect(migration).toContain("invoice_items_positive_line");
    expect(migration).toContain("INSERT INTO public.payments");
    expect(migration).toContain("payments_invoice_center_fk");
    expect(migration).toContain("'SUCCEEDED'");
    expect(migration).toContain("invoices_paid_totals_consistent");
  });

  it("makes the database catalog-authoritative and only accepts final prices for starts-from services", () => {
    expect(migration).toContain("Client\n    -- prices are ignored except for STARTING_FROM services");
    expect(migration).toContain("v_service.pricing_mode = 'STARTING_FROM'");
    expect(migration).toContain("v_item_price < v_service.price");
    expect(migration).toContain("v_item_price := round(v_product.price, 3)");
    expect(migration).toContain("v_item_price := round(v_package.package_price, 3)");
  });

  it("deducts only tracked inventory and atomically rejects unavailable/insufficient products", () => {
    expect(migration).toContain("p.track_inventory = true");
    expect(migration).toContain("p.stock_quantity >= v_item_qty::integer");
    expect(migration).toContain("p.track_inventory = false");
    expect(migration).toContain("insufficient_or_unavailable_product_stock");
  });

  it("closes direct financial writes and reports only readable source records", () => {
    expect(migration).toContain("CREATE POLICY invoices_member_select");
    expect(migration).toContain("CREATE POLICY invoice_items_member_select");
    expect(migration).toContain("CREATE POLICY payments_member_select");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM anon, authenticated");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.invoice_items FROM anon, authenticated");
  });

  it("enforces appointment relationships, valid transitions, and terminal immutability", () => {
    expect(migration).toContain("enforce_appointment_integrity_v1");
    expect(migration).toContain("new_appointment_must_be_scheduled");
    expect(migration).toContain("terminal_appointment_cannot_be_changed");
    expect(migration).toContain("terminal_appointment_cannot_be_deleted");
    expect(migration).toContain("appointment_staff_time_conflict");
  });

  it("is additive and does not seed or rewrite production business data", () => {
    const ddlBeforeCheckout = migration.slice(0, migration.indexOf("CREATE OR REPLACE FUNCTION public.process_checkout_v1"));
    expect(ddlBeforeCheckout).not.toMatch(/INSERT INTO public\.(services|products|customers|appointments|invoices)/);
    expect(migration).toContain("NOT VALID");
    expect(migration).not.toContain("DROP TABLE");
  });
});

describe("gated Arabic catalog and rollback", () => {
  it("requires an explicit demo/staging center and contains no invented products, packages, or transactions", () => {
    expect(seed).toContain("current_setting('app.seed_environment', true)");
    expect(seed).toContain("v_environment NOT IN ('demo', 'staging')");
    expect(seed).toContain("current_setting('app.seed_center_id')");
    expect(seed).not.toMatch(/INSERT INTO public\.(products|service_packages|customers|appointments|invoices|payments)/);
  });

  it("contains Arabic categories and both fixed and starts-from services", () => {
    for (const category of ["الشعر", "الأظافر", "العناية بالوجه", "إزالة الشعر", "المكياج", "الحناء"]) {
      expect(seed).toContain(category);
    }
    expect(seed).toContain("'FIXED'");
    expect(seed).toContain("'STARTING_FROM'");
    expect(seed).toContain("'مكياج عروس'");
    expect(seed).toContain("'صبغة شعر كاملة'");
  });

  it("documents a non-destructive rollback and catalog disable path", () => {
    expect(rollback).toContain("Do **not** drop");
    expect(rollback).toContain("UPDATE public.services");
    expect(rollback).toContain("SET is_active = false");
    expect(rollback).toContain("restore a verified pre-migration database backup");
  });
});

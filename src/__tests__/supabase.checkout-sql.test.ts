import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql"), "utf8");
const baseSql = readFileSync(resolve(process.cwd(), "docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql"), "utf8");

describe("Phase 10B checkout activation SQL", () => {
  it("keeps checkout activation out of the base bootstrap schema", () => {
    expect(baseSql).not.toContain("CREATE TABLE public.invoices");
    expect(baseSql).not.toContain("CREATE TABLE public.invoice_items");
    expect(baseSql).not.toContain("process_checkout_v1");
  });

  it("creates the invoice tables required by checkout, print, reports, and dashboard reads", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.invoices");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.invoice_items");
    expect(sql).toContain("center_id UUID NOT NULL REFERENCES public.centers");
    expect(sql).toContain("customer_id UUID NOT NULL REFERENCES public.customers");
    expect(sql).toContain("invoice_id UUID NOT NULL REFERENCES public.invoices");
    expect(sql).toContain("payment_method TEXT NOT NULL CHECK");
    expect(sql).toContain("idx_invoices_center_date");
  });

  it("defines RLS boundaries that allow member reads and deny direct invoice writes", () => {
    expect(sql).toContain("ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("center_id = ANY(app_private.user_center_ids())");
    expect(sql).toContain("ON public.invoices FOR INSERT");
    expect(sql).toContain("ON public.invoice_items FOR INSERT");
    expect(sql).toContain("WITH CHECK (false)");
  });

  it("defines a hardened process_checkout_v1 RPC with center authorization and stock deduction", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.process_checkout_v1");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("app_private.has_center_role");
    expect(sql).toContain("jsonb_array_elements(p_items)");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("p.stock_quantity >= v_item_qty");
    expect(sql).toContain("SET stock_quantity = p.stock_quantity - v_item_qty::INTEGER");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.process_checkout_v1");
  });
});

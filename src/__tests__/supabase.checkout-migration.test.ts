import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Validates the OFFICIAL checkout RPC migration
 * (supabase/migrations/20260628000003_checkout_rpc.sql) is internally
 * consistent and aligned to the ACTUAL shipped schema — unlike the
 * superseded docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql draft.
 */
const rpcRaw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260628000003_checkout_rpc.sql"),
  "utf8"
);
// Executable SQL only — strip "--" comment lines (the header comment
// intentionally mentions the elements this migration avoids).
const rpc = rpcRaw
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const schema = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260623000001_initial_schema.sql"),
  "utf8"
);
const rls = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260628000001_enable_rls.sql"),
  "utf8"
);

describe("Official checkout RPC migration", () => {
  it("defines process_checkout_v1 as a SECURITY DEFINER function", () => {
    expect(rpc).toContain("CREATE OR REPLACE FUNCTION public.process_checkout_v1");
    expect(rpc).toContain("SECURITY DEFINER");
    expect(rpc).toContain("GRANT  EXECUTE ON FUNCTION public.process_checkout_v1");
  });

  it("authorizes via membership helper that actually exists in the RLS migration", () => {
    expect(rpc).toContain("app_private.is_center_member");
    expect(rls).toContain("CREATE OR REPLACE FUNCTION app_private.is_center_member");
  });

  it("does NOT depend on schema elements that don't exist (soft-delete / member_role)", () => {
    expect(rpc).not.toContain("deleted_at");
    expect(rpc).not.toContain("member_role");
    expect(rpc).not.toContain("has_center_role");
    // and the real schema indeed has none of these
    expect(schema).not.toContain("deleted_at");
    expect(schema).not.toContain("member_role");
  });

  it("only references columns that exist in the real schema", () => {
    for (const col of ["loyalty_points", "stock_quantity", "is_active", "total_spent", "last_visit"]) {
      expect(schema, `schema missing ${col}`).toContain(col);
      expect(rpc, `rpc references ${col}`).toContain(col);
    }
  });

  it("implements the documented pricing semantics", () => {
    expect(rpc).toContain("v_total := v_total + (v_item_price * v_item_qty)"); // subtotal = Σ price×qty
    expect(rpc).toContain("v_earned_points := FLOOR(v_total)"); // 1 pt per OMR
    expect(rpc).toContain("LEAST(GREATEST(v_total - v_discount, 0.000), COALESCE(c.loyalty_points, 0)::NUMERIC)");
    expect(rpc).toContain("v_total := GREATEST(0.000, v_total - v_discount - v_loyalty_discount)");
  });

  it("guards stock and validates payment method + items", () => {
    expect(rpc).toContain("FOR UPDATE");
    expect(rpc).toContain("p.stock_quantity >= v_item_qty");
    expect(rpc).toContain("Insufficient product stock");
    expect(rpc).toContain("Unsupported payment method");
    expect(rpc).toContain("jsonb_array_elements(p_items)");
  });

  it("returns the shape the frontend adapter expects (invoice/total/earned)", () => {
    expect(rpc).toContain("'invoice', v_updated_invoice");
    expect(rpc).toContain("'total',   v_total");
    expect(rpc).toContain("'earned',  v_earned_points");
  });
});

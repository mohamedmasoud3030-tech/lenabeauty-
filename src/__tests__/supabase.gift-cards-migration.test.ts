import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260628000007_gift_cards.sql"), "utf8");

describe("gift cards migration", () => {
  it("creates core gift card tables with RLS", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.gift_cards");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.gift_card_transactions");
    expect(sql).toContain("ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY");
  });

  it("issues cards through a hardened SECURITY DEFINER RPC", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.issue_gift_card_v1");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("app_private.is_center_member");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.issue_gift_card_v1");
  });

  it("extends checkout RPC with gift card redemption while preserving tax flow", () => {
    expect(sql).toContain("p_gift_card_code     TEXT DEFAULT NULL");
    expect(sql).toContain("v_gift_card_discount");
    expect(sql).toContain("gift_card_transactions");
    expect(sql).toContain("v_tax_amount := ROUND((v_total * v_tax_rate / 100.000) * 1000) / 1000");
    expect(sql).toContain("v_earned_points := FLOOR(GREATEST(v_total - v_tax_amount, 0.000))");
  });
});

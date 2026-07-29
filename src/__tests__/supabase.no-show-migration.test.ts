import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260628000009_no_show_protection.sql"), "utf8");

describe("no-show protection migration", () => {
  it("extends appointments with deposit and no-show tracking columns", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS deposit_amount");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS no_show_fee_amount");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS no_show_fee_charged");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS no_show_marked_at");
  });

  it("defines a hardened no-show RPC", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.mark_appointment_no_show_v1");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("app_private.is_center_member");
    expect(sql).toContain("status = 'NO_SHOW'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.mark_appointment_no_show_v1");
  });
});

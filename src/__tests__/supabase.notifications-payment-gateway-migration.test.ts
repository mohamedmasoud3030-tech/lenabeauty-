import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260628000010_notifications_payment_gateway.sql"), "utf8");

describe("notifications + payment gateway migration", () => {
  it("creates settings tables with RLS", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.notification_settings");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.payment_gateway_settings");
    expect(sql).toContain("ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY");
  });

  it("defines hardened RPCs for notification and payment gateway settings", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.upsert_notification_settings_v1");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.upsert_payment_gateway_settings_v1");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("app_private.is_center_member");
  });
});

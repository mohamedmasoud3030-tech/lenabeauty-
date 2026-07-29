import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260628000011_client_portal.sql"), "utf8");

describe("client portal migration", () => {
  it("extends customers with portal access columns", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS portal_access_token");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS portal_access_enabled");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS portal_last_login_at");
  });

  it("defines public portal RPCs and secure token rotation", () => {
    expect(sql).toContain("public_client_portal_login_v1");
    expect(sql).toContain("public_client_portal_profile_v1");
    expect(sql).toContain("rotate_customer_portal_token_v1");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("app_private.is_center_member");
  });
});

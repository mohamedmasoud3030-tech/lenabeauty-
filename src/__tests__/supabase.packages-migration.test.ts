import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260628000008_packages_bundles.sql"), "utf8");

describe("packages migration", () => {
  it("creates package tables with RLS", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.service_packages");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.service_package_items");
    expect(sql).toContain("ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.service_package_items ENABLE ROW LEVEL SECURITY");
  });

  it("defines a hardened package creation RPC", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.create_service_package_v1");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("app_private.is_center_member");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.create_service_package_v1");
  });

  it("extends checkout RPC with package item support", () => {
    expect(sql).toContain("'service', 'product', 'package'");
    expect(sql).toContain("Package is not available for this center");
    expect(sql).toContain("service_package_items");
  });
});

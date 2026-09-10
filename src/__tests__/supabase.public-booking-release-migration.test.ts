import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

const release = readMigration("20260912110000_public_booking_release.sql");

describe("public booking release migration (20260912110000)", () => {
  const anonGranted = [
    "public_list_services_v1(UUID)",
    "public_list_staff_v1(UUID)",
    "public_center_info_v1(UUID)",
    "public_taken_slots_v1(UUID, DATE)",
    "public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT)",
    "public_cancel_booking_v1(UUID, UUID, TEXT, TEXT, TEXT)",
    "public_reschedule_booking_v1(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT)",
    "public_client_portal_login_v1(UUID, TEXT, TEXT)",
    "public_client_portal_profile_v2(UUID, UUID, TEXT, TEXT)",
  ];

  it("grants anon execute on exactly the public booking + portal surface", () => {
    for (const signature of anonGranted) {
      expect(release).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO anon, authenticated`);
      // Never exposed to the catch-all PUBLIC role.
      expect(release).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC`);
    }
  });

  it("keeps anon off every table and sequence (defense in depth)", () => {
    expect(release).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(release).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon");
  });

  it("keeps portal code rotation authenticated-only (salon issues codes)", () => {
    expect(release).toContain("REVOKE ALL ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) FROM PUBLIC, anon");
    expect(release).toContain("GRANT EXECUTE ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) TO authenticated");
  });

  it("is wired to the pages that call it (no server-only invention left)", () => {
    const routes = readFileSync(resolve(process.cwd(), "src/routes.tsx"), "utf8");
    expect(routes).toContain('path="/book"');
    expect(routes).toContain('path="/portal"');
    const adapter = readFileSync(resolve(process.cwd(), "src/infrastructure/supabase/repositories/publicAccess.ts"), "utf8");
    for (const rpc of [
      "public_center_info_v1",
      "public_list_services_v1",
      "public_list_staff_v1",
      "public_taken_slots_v1",
      "public_create_booking_v1",
      "public_client_portal_login_v1",
      "public_client_portal_profile_v2",
      "public_cancel_booking_v1",
      "public_reschedule_booking_v1",
    ]) {
      expect(adapter).toContain(`"${rpc}"`);
    }
  });
});

describe("dead surface cleanup", () => {
  it("removes the unused hard-delete adapter methods and the reminder stub", () => {
    const useCases = readFileSync(resolve(process.cwd(), "src/app/composition/useCases.ts"), "utf8");
    expect(useCases).not.toContain("sendReminder");
    expect(useCases).not.toMatch(/\.delete\(id: string\)/);
    expect(useCases).toContain("deleteRun"); // payroll run deletion stays (governed RPC)
    const shared = readFileSync(resolve(process.cwd(), "src/infrastructure/supabase/repositories/shared.ts"), "utf8");
    expect(shared).not.toContain("deleteById");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810000005_security_hardening_auth.sql"),
  "utf8",
);
const grantRepair = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810000006_security_grant_repair.sql"),
  "utf8",
);
const sqlTest = readFileSync(
  resolve(process.cwd(), "supabase/tests/20260810000005_security_hardening.sql"),
  "utf8",
);

describe("phase 4 security hardening migrations", () => {
  it("locks an immutable search_path on every app-owned routine", () => {
    expect(migration).toContain("ALTER FUNCTION %s SET search_path TO pg_catalog, public, app_private");
    expect(migration).toContain("lanname = 'plpgsql'");
    expect(migration).toContain("lanname = 'sql'");
  });

  it("resets inherited client grants in the final repair migration", () => {
    for (const schema of ["public", "app_private"]) {
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        expect(grantRepair).toContain(
          `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${schema} FROM ${role}`,
        );
      }
    }
  });

  it("keeps public booking/client-portal RPCs installed but ungranted", () => {
    for (const fn of [
      "public_list_services_v1",
      "public_list_staff_v1",
      "public_center_info_v1",
      "public_taken_slots_v1",
      "public_create_booking_v1",
      "public_client_portal_login_v1",
      "public_client_portal_profile_v1",
      "public_client_portal_profile_v2",
      "public_cancel_booking_v1",
      "public_reschedule_booking_v1",
    ]) {
      expect(grantRepair).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
  });

  it("grants only the current checkout overload, not the legacy overload", () => {
    expect(grantRepair).toContain(
      "public.process_checkout_v1(\n  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT\n) TO authenticated",
    );
    expect(grantRepair).not.toContain(
      "public.process_checkout_v1(\n  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB\n) TO authenticated",
    );
  });

  it("scopes storage objects to center path + membership", () => {
    expect(migration).toContain("center_assets_member_select");
    expect(migration).toContain("center_assets_member_insert");
    expect(migration).toContain("center_assets_member_update");
    expect(migration).toContain("app_private.storage_path_center_id(name)");
    expect(migration).toContain("app_private.is_center_member(app_private.storage_path_center_id(name))");
    expect(migration).toContain("DROP POLICY IF EXISTS center_assets_read   ON storage.objects");
  });

  it("rejects caller-supplied cross-center entity references in write RPCs", () => {
    for (const token of ["customer_not_in_center", "appointment_not_in_center", "service_not_in_center"]) {
      expect(migration).toContain(token);
    }
    expect(migration).toContain("p_reference_id is an informational reference");
  });

  it("keeps client-portal profile projection free of portal credentials", () => {
    const projection = migration.slice(
      migration.indexOf("'customer', jsonb_build_object("),
      migration.indexOf("'appointments', COALESCE(("),
    );
    expect(projection).toContain("'portal_last_login_at', v_customer.portal_last_login_at");
    expect(projection).not.toContain("portal_access_token");
    expect(projection).not.toContain("portal_failed_login_attempts");
    expect(projection).not.toContain("portal_locked_until");
  });

  it("removes member DELETE on center_settings", () => {
    expect(migration).toContain("CREATE POLICY center_settings_select ON public.center_settings");
    expect(migration).toContain("CREATE POLICY center_settings_insert ON public.center_settings");
    expect(migration).toContain("CREATE POLICY center_settings_update ON public.center_settings");
    const settingsSection = migration.slice(
      migration.indexOf("6. center_settings"),
      migration.indexOf("7. Remove anonymous table-level privileges"),
    );
    expect(settingsSection).not.toContain("FOR DELETE");
  });

  it("revokes anonymous table privileges", () => {
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(migration).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon");
  });

  it("treats managed Auth protections as guarded operational settings", () => {
    expect(migration).toContain("password_hibp_enabled = true");
    expect(migration).toContain("security_update_password_require_reauthentication = true");
    expect(migration).toContain("auth.config is not present");
    expect(migration).not.toContain("UPDATE auth.config SET password_min_length");
  });

  it("is additive and does not mutate business rows", () => {
    expect(migration).not.toMatch(/INSERT INTO public\.(customers|appointments|invoices|services|products|employees)/);
    expect(migration).not.toMatch(/DELETE FROM public\.(customers|appointments|invoices|services|products|employees)/);
    expect(grantRepair).not.toMatch(/INSERT INTO public\./);
    expect(grantRepair).not.toMatch(/DELETE FROM public\./);
  });

  it("ships executable behavioral acceptance using managed-Supabase-compatible fixtures", () => {
    expect(sqlTest).toContain("SET ROLE authenticated");
    expect(sqlTest).toContain("request.jwt.claim.sub");
    expect(sqlTest).not.toContain("confirmed_at,");
    expect(sqlTest).toContain("5::smallint");
    expect(sqlTest).toContain("NULL::text");
    expect(sqlTest).toContain("with_check::text");
    expect(sqlTest.trimEnd()).toMatch(/ROLLBACK;$/);
  });
});

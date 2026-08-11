import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810000005_security_hardening_auth.sql"),
  "utf8",
);
const sqlTest = readFileSync(
  resolve(process.cwd(), "supabase/tests/20260810000005_security_hardening.sql"),
  "utf8",
);

describe("phase 4 security hardening migration", () => {
  it("locks an immutable search_path on every app-owned routine (sql + plpgsql)", () => {
    expect(migration).toContain("ALTER FUNCTION %s SET search_path TO pg_catalog, public, app_private");
    expect(migration).toContain("lanname = 'plpgsql'");
    expect(migration).toContain("lanname = 'sql'");
  });

  it("removes default PUBLIC EXECUTE and re-grants only the whitelisted staff RPCs", () => {
    expect(migration).toContain("REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public      FROM PUBLIC");
    expect(migration).toContain("REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC");
    for (const fn of [
      "process_checkout_v1",
      "upsert_notification_settings_v1",
      "upsert_payment_gateway_settings_v1",
      "mark_appointment_no_show_v1",
      "issue_gift_card_v1",
      "create_service_package_v1",
      "rotate_customer_portal_token_v1",
      "create_customer_review_v1",
      "create_service_file_v1",
      "add_customer_notification_event_v1",
      "create_accounting_journal_entry_v1",
      "create_ai_booking_lead_v1",
    ]) {
      expect(migration).toContain(`'${fn}'`);
    }
  });

  it("leaves the public booking / client-portal RPCs defined but with zero grants", () => {
    // No role (not even authenticated) may execute booking RPCs in this
    // staff-only release; the landing phase re-grants them explicitly.
    for (const fn of [
      "public_create_booking_v1",
      "public_client_portal_login_v1",
      "public_client_portal_profile_v2",
      "public_cancel_booking_v1",
      "public_reschedule_booking_v1",
    ]) {
      expect(migration).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    expect(migration).toContain("no role may execute them until that phase re-grants them explicitly");
  });

  it("keeps the RLS helper routines executable by anon + authenticated", () => {
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION app_private.user_center_ids() TO anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION app_private.is_center_member(UUID) TO anon, authenticated");
  });

  it("scopes storage object policies to the center path segment + membership", () => {
    expect(migration).toContain("center_assets_member_select");
    expect(migration).toContain("center_assets_member_insert");
    expect(migration).toContain("center_assets_member_update");
    expect(migration).toContain("app_private.storage_path_center_id(name)");
    expect(migration).toContain("app_private.is_center_member(app_private.storage_path_center_id(name))");
    expect(migration).toContain("DROP POLICY IF EXISTS center_assets_read   ON storage.objects");
    // The helper's EXECUTE grant must come after its creation (a function
    // created fresh would otherwise keep the default PUBLIC EXECUTE).
    expect(
      migration.indexOf("REVOKE ALL ON FUNCTION app_private.storage_path_center_id(TEXT) FROM PUBLIC"),
    ).toBeGreaterThan(
      migration.indexOf("CREATE OR REPLACE FUNCTION app_private.storage_path_center_id"),
    );
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION app_private.storage_path_center_id(TEXT) TO anon, authenticated");
  });

  it("rejects caller-supplied cross-center entity references in write RPCs", () => {
    for (const token of ["customer_not_in_center", "appointment_not_in_center", "service_not_in_center"]) {
      expect(migration).toContain(token);
    }
    // The accounting journal RPC documents why reference_id cannot be
    // center-validated (opaque, no FK) instead of pretending to.
    expect(migration).toContain("p_reference_id is an informational reference");
  });

  it("keeps the client-portal profile projection free of the portal credential", () => {
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
    expect(migration).toContain("DROP POLICY IF EXISTS center_settings_select ON public.center_settings");
    expect(migration).toContain("DROP POLICY IF EXISTS center_settings_write   ON public.center_settings");
    expect(migration).toContain("CREATE POLICY center_settings_select ON public.center_settings");
    expect(migration).toContain("CREATE POLICY center_settings_insert ON public.center_settings");
    expect(migration).toContain("CREATE POLICY center_settings_update ON public.center_settings");
    // No DELETE policy may be (re)created for center_settings.
    const settingsSection = migration.slice(
      migration.indexOf("6. center_settings"),
      migration.indexOf("7. Remove anonymous table-level privileges"),
    );
    expect(settingsSection).not.toContain("FOR DELETE");
  });

  it("revokes anonymous table privileges and enables guarded auth protections", () => {
    expect(migration).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(migration).toContain("password_hibp_enabled = true");
    expect(migration).toContain("security_update_password_require_reauthentication = true");
    expect(migration).toContain("information_schema.columns");
    // password_min_length must NOT be forced (existing demo credentials stay
    // sign-in compatible) — and the reason must be documented in the file.
    expect(migration).not.toContain("UPDATE auth.config SET password_min_length");
    expect(migration.toLowerCase()).toContain("password_min_length");
  });

  it("is additive and touches no business rows", () => {
    expect(migration).not.toMatch(/INSERT INTO public\.(customers|appointments|invoices|services|products|employees)/);
    expect(migration).not.toMatch(/DELETE FROM public\.(customers|appointments|invoices|services|products|employees)/);
  });

  it("has an accompanying behavioral SQL acceptance test", () => {
    expect(sqlTest).toContain("has_function_privilege('anon'");
    expect(sqlTest).toContain("SET ROLE authenticated");
    expect(sqlTest).toContain("request.jwt.claim.sub");
    expect(sqlTest).toContain("cross-center checkout must be rejected");
    expect(sqlTest).toContain("center_assets_member_select");
    expect(sqlTest).toContain("portal_access_token");
    expect(sqlTest).toContain("ROLLBACK");
  });
});

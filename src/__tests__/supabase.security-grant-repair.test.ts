import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810000006_security_grant_repair.sql"),
  "utf8",
);

describe("security grant repair", () => {
  it("revokes inherited client-role grants before re-granting anything", () => {
    for (const schema of ["public", "app_private"]) {
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        expect(migration).toContain(
          `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${schema} FROM ${role}`,
        );
      }
    }
  });

  it("grants only the current 8-argument checkout overload", () => {
    expect(migration).toContain(
      "public.process_checkout_v1(\n  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT\n) TO authenticated",
    );
    expect(migration).not.toContain(
      "public.process_checkout_v1(\n  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB\n) TO authenticated",
    );
  });

  it("does not grant the dormant public booking/client-portal RPC surface", () => {
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
      expect(migration).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
  });

  it("does not grant the unused notification-event RPC", () => {
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.add_customer_notification_event_v1",
    );
  });

  it("re-grants only the eleven exact staff UI RPC signatures", () => {
    const grants = migration.match(/GRANT EXECUTE ON FUNCTION public\./g) ?? [];
    expect(grants).toHaveLength(11);

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
      "create_accounting_journal_entry_v1",
      "create_ai_booking_lead_v1",
    ]) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}(`);
    }
  });

  it("keeps only authenticated policy-helper execution and hardens future defaults", () => {
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION app_private.user_center_ids() TO authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION app_private.is_center_member(UUID) TO authenticated",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION app_private.storage_path_center_id(TEXT) TO authenticated",
    );
    expect(migration).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public",
    );
    expect(migration).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA app_private",
    );
  });
});

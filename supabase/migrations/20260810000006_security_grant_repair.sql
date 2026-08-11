-- =============================================================================
-- LenaBeauty — final least-privilege RPC grant repair
-- =============================================================================
-- Live staging verification of 00005 found that revoking PUBLIC does not remove
-- grants inherited explicitly by `anon` / `authenticated` from older migrations.
-- This migration resets those role grants, then re-grants only the exact RPC
-- signatures used by the current staff UI. Public booking / portal RPCs remain
-- installed but deliberately have zero client-role EXECUTE grants until the
-- customer-booking phase explicitly enables them.
-- =============================================================================

BEGIN;

-- Reset all inherited client-role grants. PUBLIC is reset as defense in depth.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM authenticated;

-- Prevent new app functions created by the migration owner from receiving the
-- PostgreSQL default PUBLIC EXECUTE privilege automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Exact staff-UI RPC surface. Keep signatures explicit: do not grant by name,
-- because overloads and future functions must not become executable by accident.
GRANT EXECUTE ON FUNCTION public.process_checkout_v1(
  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_notification_settings_v1(
  UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_payment_gateway_settings_v1(
  UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.mark_appointment_no_show_v1(
  UUID, UUID, BOOLEAN, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.issue_gift_card_v1(
  UUID, TEXT, NUMERIC, UUID, TEXT, TIMESTAMPTZ
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_service_package_v1(
  UUID, TEXT, TEXT, NUMERIC, JSONB
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rotate_customer_portal_token_v1(
  UUID, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_customer_review_v1(
  UUID, UUID, UUID, SMALLINT, TEXT, BOOLEAN
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_service_file_v1(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT[], TEXT[], TEXT[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_accounting_journal_entry_v1(
  UUID, DATE, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_ai_booking_lead_v1(
  UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT
) TO authenticated;

-- RLS/storage policy helpers needed by authenticated table/storage access.
GRANT EXECUTE ON FUNCTION app_private.user_center_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_center_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.storage_path_center_id(TEXT) TO authenticated;

COMMIT;

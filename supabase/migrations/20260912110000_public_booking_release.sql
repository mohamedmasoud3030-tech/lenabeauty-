-- =============================================================================
-- LenaBeauty — Public booking & client portal release (intentional activation).
--
-- The public booking and client-portal RPCs have existed in the canonical
-- chain since 2026-06 (services/staff/center/slots reads, booking create,
-- cancel, reschedule, portal login with lockout, portal profile). They were
-- granted to `anon` by their original migrations, then the live projects
-- deliberately revoked anon execution until a public UI shipped
-- (docs/FREE_PLAN_SECURITY_LIMITATIONS.md: "Public booking/client-portal RPC
-- grants disabled until that feature is intentionally released").
--
-- This migration IS that intentional release: the app now ships public screens
-- (#/book and #/portal) that call exactly these RPCs and nothing else. It
-- re-asserts the anon grants, idempotently, for:
--   - the public booking surface (5 read/create functions + cancel/reschedule)
--   - the client portal surface (login + profile v2)
--
-- Anonymous callers still cannot touch any table directly (RLS + revoked
-- table grants); every public capability runs through these SECURITY DEFINER
-- functions with their built-in validation, exact-credential checks and
-- lockout. rotate_customer_portal_token_v1 stays authenticated-only (admin
-- issues codes from the Customers screen).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Public booking surface
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.public_list_services_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_list_services_v1(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_list_staff_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_list_staff_v1(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_center_info_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_center_info_v1(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_taken_slots_v1(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_taken_slots_v1(UUID, DATE) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_cancel_booking_v1(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_cancel_booking_v1(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_reschedule_booking_v1(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_reschedule_booking_v1(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Client portal surface
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.public_client_portal_login_v1(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_client_portal_login_v1(UUID, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_client_portal_profile_v2(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_client_portal_profile_v2(UUID, UUID, TEXT, TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Guardrails (statements, not policy): document the boundary this release
--    must keep. Tables stay fully revoked for anon; the token rotation stays
--    authenticated-only. Re-asserted here so a drift audit can diff this file.
-- -----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

REVOKE ALL ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) TO authenticated;

COMMIT;

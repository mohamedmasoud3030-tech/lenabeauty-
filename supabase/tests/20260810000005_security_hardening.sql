-- =============================================================================
-- Behavioral security/RLS acceptance for 20260810000005_security_hardening_auth
-- =============================================================================
-- Run only after the full migration chain in an isolated database (a Supabase
-- project SQL editor or a local `supabase start` stack — the standard
-- `anon` / `authenticated` roles are required). Every row created below is
-- rolled back. A successful run reaches the final ROLLBACK.
--
-- Prerequisite note: the fixture uses minimal auth.users rows (the same
-- pattern as the admin-bootstrap workflow). If the platform's auth schema
-- requires extra NOT NULL columns, fill them in the same INSERT.
--
-- Privilege boundary under test:
--   * anon must NOT execute any SECURITY DEFINER RPC and must have NO table
--     privileges in the public schema;
--   * authenticated members may execute ONLY the whitelisted staff RPCs;
--   * RLS keeps members of center A unable to read/insert center B data
--     (including by guessing a UUID of another center's customer);
--   * RPCs reject caller-supplied cross-center entity references;
--   * storage object policies are center-member scoped;
--   * center_settings cannot be deleted by members;
--   * the client-portal profile projection does not echo the portal token.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Fixtures (run as the migration owner / postgres: RLS is bypassed)
-- -----------------------------------------------------------------------------
INSERT INTO public.centers (id, name)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'Security test center A'),
  ('20000000-0000-4000-8000-000000000002', 'Security test center B');

INSERT INTO public.center_settings (center_id, name, currency)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'Security test center A', 'OMR'),
  ('20000000-0000-4000-8000-000000000002', 'Security test center B', 'OMR')
ON CONFLICT (center_id) DO NOTHING;

-- Minimal auth.users rows so the profiles FK is satisfiable.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmed_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated',
    'member.a@lenabeauty.test', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"ADMIN"}'::jsonb,
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated',
    'member.b@lenabeauty.test', crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"role":"ADMIN"}'::jsonb,
    now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'Member A'),
  ('30000000-0000-4000-8000-000000000002', 'Member B');

INSERT INTO public.center_memberships (profile_id, center_id)
VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002');

INSERT INTO public.customers (id, center_id, name, phone)
VALUES
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Customer A', '+96800000001'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Customer B', '+96800000002');

-- -----------------------------------------------------------------------------
-- 1. Routine privilege boundaries
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  booking_rpcs TEXT[] := ARRAY[
    'public.public_list_services_v1(uuid)',
    'public.public_list_staff_v1(uuid)',
    'public.public_center_info_v1(uuid)',
    'public.public_taken_slots_v1(uuid, date)',
    'public.public_create_booking_v1(uuid, uuid, uuid, text, text, timestamptz, text)',
    'public.public_client_portal_login_v1(uuid, text, text)',
    'public.public_client_portal_profile_v1(uuid, uuid, text, text)',
    'public.public_client_portal_profile_v2(uuid, uuid, text, text)',
    'public.public_cancel_booking_v1(uuid, uuid, text, text, text)',
    'public.public_reschedule_booking_v1(uuid, uuid, text, text, timestamptz, uuid, text)'
  ];
  staff_rpcs TEXT[] := ARRAY[
    'public.process_checkout_v1(uuid, uuid, uuid, text, numeric, boolean, jsonb, text)',
    'public.upsert_notification_settings_v1(uuid, boolean, boolean, boolean, integer, text, text, text, text, text)',
    'public.upsert_payment_gateway_settings_v1(uuid, text, boolean, boolean, text, text, text, boolean, text, numeric, text, text)',
    'public.mark_appointment_no_show_v1(uuid, uuid, boolean, text)',
    'public.issue_gift_card_v1(uuid, text, numeric, uuid, text, timestamptz)',
    'public.create_service_package_v1(uuid, text, text, numeric, jsonb)',
    'public.rotate_customer_portal_token_v1(uuid, uuid)',
    'public.create_customer_review_v1(uuid, uuid, uuid, smallint, text, boolean)',
    'public.create_service_file_v1(uuid, uuid, uuid, uuid, text, text, text[], text[], text[])',
    'public.add_customer_notification_event_v1(uuid, uuid, uuid, text, text, text, text, text, timestamptz)',
    'public.create_accounting_journal_entry_v1(uuid, date, text, text, uuid, text, text, text, numeric, text)',
    'public.create_ai_booking_lead_v1(uuid, text, text, uuid, timestamptz, text, text)'
  ];
  r TEXT;
BEGIN
  -- anon must not be able to execute any public-booking / client-portal RPC
  FOREACH r IN ARRAY booking_rpcs LOOP
    IF to_regprocedure(r) IS NOT NULL
       AND has_function_privilege('anon', to_regprocedure(r), 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute %', r;
    END IF;
  END LOOP;

  -- anon must not be able to execute the staff RPCs either
  FOREACH r IN ARRAY staff_rpcs LOOP
    IF to_regprocedure(r) IS NOT NULL
       AND has_function_privilege('anon', to_regprocedure(r), 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute %', r;
    END IF;
  END LOOP;

  -- authenticated staff RPCs must remain executable (shipped UI calls them)
  FOREACH r IN ARRAY staff_rpcs LOOP
    IF to_regprocedure(r) IS NULL
       OR NOT has_function_privilege('authenticated', to_regprocedure(r), 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must be able to execute %', r;
    END IF;
  END LOOP;

  -- the RLS helpers stay executable by both roles (policy evaluation)
  IF to_regprocedure('app_private.user_center_ids()') IS NULL
     OR NOT has_function_privilege('anon', to_regprocedure('app_private.user_center_ids()'), 'EXECUTE')
     OR NOT has_function_privilege('anon', to_regprocedure('app_private.is_center_member(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'anon needs EXECUTE on RLS helper routines for policy evaluation';
  END IF;
  IF NOT has_function_privilege('authenticated', to_regprocedure('app_private.user_center_ids()'), 'EXECUTE')
     OR NOT has_function_privilege('authenticated', to_regprocedure('app_private.is_center_member(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated needs EXECUTE on RLS helper routines';
  END IF;
END
$$;

-- anon must have zero table privileges in the public schema
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.customers', 'SELECT')
     OR has_table_privilege('anon', 'public.customers', 'INSERT')
     OR has_table_privilege('anon', 'public.invoices', 'SELECT') THEN
    RAISE EXCEPTION 'anon must have no table privileges in the public schema';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. RLS tenant isolation (as authenticated member A)
-- -----------------------------------------------------------------------------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);

-- Precise assertions: member A sees center A's fixture rows, never center B's
-- rows, even when guessing the other center's UUID directly.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.customers
  WHERE id = '40000000-0000-4000-8000-000000000002'; -- center B customer UUID guess
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'member A must not read center B customers by UUID, saw %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.customers
  WHERE center_id = '20000000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'member A must not enumerate center B customers, saw %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.customers
  WHERE center_id = '20000000-0000-4000-8000-000000000001';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'member A must see exactly 1 customer in own center, saw %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.centers
  WHERE id = '20000000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'member A must not see center B, saw %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.invoices
  WHERE center_id = '20000000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'member A must not read center B invoices';
  END IF;
END
$$;

-- cross-center INSERT must be rejected by RLS (WITH CHECK)
DO $$
BEGIN
  BEGIN
    INSERT INTO public.customers (id, center_id, name, phone)
    VALUES (
      '40000000-0000-4000-8000-000000000099',
      '20000000-0000-4000-8000-000000000002', -- center B
      'Impostor',
      '+96800000099'
    );
    RAISE EXCEPTION 'cross-center INSERT must be blocked by RLS';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

-- cross-center checkout must fail with the unauthorized-center error (42501)
DO $$
BEGIN
  BEGIN
    PERFORM public.process_checkout_v1(
      '20000000-0000-4000-8000-000000000002', -- center B
      '40000000-0000-4000-8000-000000000002', -- customer B
      NULL, 'cash', 0, false, '[]'::jsonb
    );
    RAISE EXCEPTION 'cross-center checkout must be rejected';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

-- cross-center customer reference in create_service_file_v1 must be rejected
DO $$
BEGIN
  BEGIN
    PERFORM public.create_service_file_v1(
      '20000000-0000-4000-8000-000000000001', -- center A
      '40000000-0000-4000-8000-000000000002', -- customer B (other center)
      NULL, NULL, 'Impostor file', NULL,
      ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]
    );
    RAISE EXCEPTION 'cross-center service file must be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

-- cross-center customer reference in create_customer_review_v1 must be rejected
DO $$
BEGIN
  BEGIN
    PERFORM public.create_customer_review_v1(
      '20000000-0000-4000-8000-000000000001', -- center A
      '40000000-0000-4000-8000-000000000002', -- customer B (other center)
      NULL, 5, 'review', false
    );
    RAISE EXCEPTION 'cross-center review must be rejected';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

-- same-center positive paths must still work for the hardened RPCs
DO $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.create_customer_review_v1(
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    NULL, 5, 'Great visit', false
  );
  IF v_result->'review'->>'center_id' <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'same-center review must be created in the caller center';
  END IF;

  v_result := public.create_service_file_v1(
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    NULL, NULL, 'Consultation', 'Photo notes',
    ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]
  );
  IF v_result->'service_file'->>'center_id' <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'same-center service file must be created in the caller center';
  END IF;
END
$$;

-- members must NOT be able to delete their own center_settings row
DO $$
BEGIN
  DELETE FROM public.center_settings
  WHERE center_id = '20000000-0000-4000-8000-000000000001';
  IF NOT EXISTS (
    SELECT 1 FROM public.center_settings
    WHERE center_id = '20000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'members must not be able to delete center_settings';
  END IF;
END
$$;

RESET ROLE;

-- -----------------------------------------------------------------------------
-- 3. Storage policy scoping (static policy definition checks)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_qual TEXT;
BEGIN
  SELECT qual::text INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'center_assets_member_select'
    AND cmd = 'SELECT';
  IF v_qual IS NULL THEN
    RAISE EXCEPTION 'center_assets_member_select policy is missing';
  END IF;
  IF v_qual NOT LIKE '%app_private.is_center_member%'
     OR v_qual NOT LIKE '%center-assets%' THEN
    RAISE EXCEPTION 'storage select policy is not center-member scoped: %', v_qual;
  END IF;

  SELECT qual::text INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'center_assets_member_insert'
    AND cmd = 'INSERT';
  IF v_qual IS NULL OR v_qual NOT LIKE '%app_private.is_center_member%' THEN
    RAISE EXCEPTION 'storage insert policy is not center-member scoped';
  END IF;

  SELECT qual::text INTO v_qual
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'center_assets_member_update'
    AND cmd = 'UPDATE';
  IF v_qual IS NULL OR v_qual NOT LIKE '%app_private.is_center_member%' THEN
    RAISE EXCEPTION 'storage update policy is not center-member scoped';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN ('center_assets_read', 'center_assets_write', 'center_assets_update')
  ) THEN
    RAISE EXCEPTION 'legacy unscoped storage policies must be gone';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 4. Client-portal profile projection must not echo the portal credential
-- -----------------------------------------------------------------------------
UPDATE public.customers
SET portal_access_token = 'abcdef123456'
WHERE id = '40000000-0000-4000-8000-000000000001';

DO $$
DECLARE
  v_profile JSONB;
BEGIN
  v_profile := public.public_client_portal_profile_v2(
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '+96800000001',
    'abcdef123456'
  );
  IF v_profile ? 'portal_access_token'
     OR v_profile->'customer' ? 'portal_access_token'
     OR v_profile->'customer' ? 'portal_failed_login_attempts'
     OR v_profile->'customer' ? 'portal_locked_until' THEN
    RAISE EXCEPTION 'portal profile must not expose the portal credential or lockout counters';
  END IF;
  IF v_profile->'customer'->>'id' <> '40000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'portal profile must return the authenticated customer';
  END IF;
END
$$;

ROLLBACK;

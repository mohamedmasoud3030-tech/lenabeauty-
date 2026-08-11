-- Behavioral security/RLS acceptance for 20260810000005_security_hardening_auth.
-- Runs inside one transaction and leaves no residue.

BEGIN;

-- Minimal fixtures. `auth.users.confirmed_at` is generated on managed Supabase,
-- so do not write it directly. Only the stable columns required by the FK are used.
INSERT INTO public.centers (id, name)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'Security test center A'),
  ('20000000-0000-4000-8000-000000000002', 'Security test center B');

INSERT INTO public.center_settings (center_id, name, currency)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'Security test center A', 'OMR'),
  ('20000000-0000-4000-8000-000000000002', 'Security test center B', 'OMR')
ON CONFLICT (center_id) DO NOTHING;

INSERT INTO auth.users (id, email)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'member.a@lenabeauty.test'),
  ('30000000-0000-4000-8000-000000000002', 'member.b@lenabeauty.test')
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

-- 1. Routine privilege boundaries.
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
  FOREACH r IN ARRAY booking_rpcs LOOP
    IF to_regprocedure(r) IS NOT NULL
       AND has_function_privilege('anon', to_regprocedure(r), 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute %', r;
    END IF;
  END LOOP;

  FOREACH r IN ARRAY staff_rpcs LOOP
    IF to_regprocedure(r) IS NOT NULL
       AND has_function_privilege('anon', to_regprocedure(r), 'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute %', r;
    END IF;
    IF to_regprocedure(r) IS NULL
       OR NOT has_function_privilege('authenticated', to_regprocedure(r), 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must be able to execute %', r;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('anon', 'app_private.user_center_ids()', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'app_private.is_center_member(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'app_private.user_center_ids()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'app_private.is_center_member(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'RLS helper EXECUTE grants are incomplete';
  END IF;
END
$$;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.customers', 'SELECT')
     OR has_table_privilege('anon', 'public.customers', 'INSERT')
     OR has_table_privilege('anon', 'public.invoices', 'SELECT') THEN
    RAISE EXCEPTION 'anon must have no table privileges in public';
  END IF;
END
$$;

-- 2. RLS tenant isolation as member A.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(*) INTO v_count FROM public.customers
  WHERE id = '40000000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN RAISE EXCEPTION 'cross-center customer UUID became visible'; END IF;

  SELECT count(*) INTO v_count FROM public.customers
  WHERE center_id = '20000000-0000-4000-8000-000000000001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'own-center customer is not visible'; END IF;

  SELECT count(*) INTO v_count FROM public.centers
  WHERE id = '20000000-0000-4000-8000-000000000002';
  IF v_count <> 0 THEN RAISE EXCEPTION 'cross-center center row became visible'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.customers (id, center_id, name, phone)
    VALUES ('40000000-0000-4000-8000-000000000099', '20000000-0000-4000-8000-000000000002', 'Impostor', '+96800000099');
    RAISE EXCEPTION 'cross-center INSERT must be blocked by RLS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.process_checkout_v1(
      '20000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000002',
      NULL, 'cash', 0, false, '[]'::jsonb
    );
    RAISE EXCEPTION 'cross-center checkout must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$$;

DO $$
BEGIN
  BEGIN
    PERFORM public.create_service_file_v1(
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      NULL, NULL, 'Impostor file', NULL,
      ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]
    );
    RAISE EXCEPTION 'cross-center service file must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    PERFORM public.create_customer_review_v1(
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      NULL, 5, 'review', false
    );
    RAISE EXCEPTION 'cross-center review must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END
$$;

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
    RAISE EXCEPTION 'same-center review failed';
  END IF;

  v_result := public.create_service_file_v1(
    '20000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    NULL, NULL, 'Consultation', 'Photo notes',
    ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[]
  );
  IF v_result->'service_file'->>'center_id' <> '20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'same-center service file failed';
  END IF;
END
$$;

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

-- 3. Storage policy scoping. INSERT policies store their predicate in
-- pg_policies.with_check, not qual.
DO $$
DECLARE
  v_expr TEXT;
BEGIN
  SELECT qual::text INTO v_expr
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'center_assets_member_select' AND cmd = 'SELECT';
  IF v_expr IS NULL OR v_expr NOT LIKE '%app_private.is_center_member%'
     OR v_expr NOT LIKE '%center-assets%' THEN
    RAISE EXCEPTION 'center_assets_member_select is not center-scoped';
  END IF;

  SELECT with_check::text INTO v_expr
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'center_assets_member_insert' AND cmd = 'INSERT';
  IF v_expr IS NULL OR v_expr NOT LIKE '%app_private.is_center_member%' THEN
    RAISE EXCEPTION 'center_assets_member_insert is not center-scoped';
  END IF;

  SELECT qual::text INTO v_expr
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'center_assets_member_update' AND cmd = 'UPDATE';
  IF v_expr IS NULL OR v_expr NOT LIKE '%app_private.is_center_member%' THEN
    RAISE EXCEPTION 'center_assets_member_update is not center-scoped';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('center_assets_read', 'center_assets_write', 'center_assets_update')
  ) THEN
    RAISE EXCEPTION 'legacy unscoped storage policies remain';
  END IF;
END
$$;

-- 4. Portal profile must not echo portal_access_token or lockout counters.
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
    RAISE EXCEPTION 'portal profile exposes portal_access_token or lockout counters';
  END IF;
END
$$;

ROLLBACK;

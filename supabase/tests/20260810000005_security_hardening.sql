-- Behavioral security/RLS acceptance for 20260810000005_security_hardening_auth.
-- Every fixture is rolled back.
BEGIN;

INSERT INTO public.centers(id,name) VALUES
('20000000-0000-4000-8000-000000000001'::uuid,'Security test center A'),
('20000000-0000-4000-8000-000000000002'::uuid,'Security test center B');

INSERT INTO public.center_settings(center_id,name,currency) VALUES
('20000000-0000-4000-8000-000000000001'::uuid,'Security test center A','OMR'),
('20000000-0000-4000-8000-000000000002'::uuid,'Security test center B','OMR')
ON CONFLICT(center_id) DO NOTHING;

-- confirmed_at is generated on managed Supabase; only stable auth columns are written.
INSERT INTO auth.users(id,email) VALUES
('30000000-0000-4000-8000-000000000001'::uuid,'member.a@lenabeauty.test'),
('30000000-0000-4000-8000-000000000002'::uuid,'member.b@lenabeauty.test')
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.profiles(id,full_name) VALUES
('30000000-0000-4000-8000-000000000001'::uuid,'Member A'),
('30000000-0000-4000-8000-000000000002'::uuid,'Member B');

INSERT INTO public.center_memberships(profile_id,center_id) VALUES
('30000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid),
('30000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid);

INSERT INTO public.customers(id,center_id,name,phone,portal_access_enabled,portal_access_token) VALUES
('40000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'Customer A','+96800000001',true,'abcdef123456'),
('40000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'Customer B','+96800000002',false,null);

-- Privilege boundaries.
DO $$
DECLARE
  r text;
  booking_rpcs text[] := ARRAY[
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
  staff_rpcs text[] := ARRAY[
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
BEGIN
  FOREACH r IN ARRAY booking_rpcs LOOP
    IF to_regprocedure(r) IS NOT NULL AND has_function_privilege('anon',to_regprocedure(r),'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute %',r;
    END IF;
  END LOOP;
  FOREACH r IN ARRAY staff_rpcs LOOP
    IF to_regprocedure(r) IS NULL OR NOT has_function_privilege('authenticated',to_regprocedure(r),'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must execute %',r;
    END IF;
    IF has_function_privilege('anon',to_regprocedure(r),'EXECUTE') THEN
      RAISE EXCEPTION 'anon must not execute %',r;
    END IF;
  END LOOP;
  IF has_table_privilege('anon','public.customers','SELECT')
     OR has_table_privilege('anon','public.customers','INSERT')
     OR has_table_privilege('anon','public.invoices','SELECT') THEN
    RAISE EXCEPTION 'anon retains public table privileges';
  END IF;
END
$$;

-- RLS and cross-center RPC protection.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.customers WHERE id='40000000-0000-4000-8000-000000000002'::uuid;
  IF n<>0 THEN RAISE EXCEPTION 'cross-center customer visible'; END IF;
  SELECT count(*) INTO n FROM public.customers WHERE id='40000000-0000-4000-8000-000000000001'::uuid;
  IF n<>1 THEN RAISE EXCEPTION 'own customer invisible'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.customers(id,center_id,name,phone) VALUES(
      '40000000-0000-4000-8000-000000000099'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,'Impostor','+96800000099');
    RAISE EXCEPTION 'cross-center INSERT must be blocked by RLS';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    PERFORM public.process_checkout_v1(
      '20000000-0000-4000-8000-000000000002'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid,
      NULL::uuid,'cash'::text,0::numeric,false,'[]'::jsonb,NULL::text);
    RAISE EXCEPTION 'cross-center checkout must be rejected';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    PERFORM public.create_service_file_v1(
      '20000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid,
      NULL::uuid,NULL::uuid,'Impostor file'::text,NULL::text,
      ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
    RAISE EXCEPTION 'cross-center service file must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;

  BEGIN
    PERFORM public.create_customer_review_v1(
      '20000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid,
      NULL::uuid,5::smallint,'review'::text,false);
    RAISE EXCEPTION 'cross-center review must be rejected';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END
$$;

DO $$
DECLARE x jsonb;
BEGIN
  x:=public.create_customer_review_v1(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '40000000-0000-4000-8000-000000000001'::uuid,
    NULL::uuid,5::smallint,'Great visit'::text,false);
  IF x->'review'->>'center_id'<>'20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'same-center review failed';
  END IF;

  x:=public.create_service_file_v1(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '40000000-0000-4000-8000-000000000001'::uuid,
    NULL::uuid,NULL::uuid,'Consultation'::text,'Photo notes'::text,
    ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[]);
  IF x->'service_file'->>'center_id'<>'20000000-0000-4000-8000-000000000001' THEN
    RAISE EXCEPTION 'same-center service file failed';
  END IF;
END
$$;

DO $$
BEGIN
  DELETE FROM public.center_settings WHERE center_id='20000000-0000-4000-8000-000000000001'::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.center_settings WHERE center_id='20000000-0000-4000-8000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'members must not delete center_settings';
  END IF;
END
$$;
RESET ROLE;

-- Storage policies: INSERT uses with_check, SELECT/UPDATE use qual.
DO $$
DECLARE e text;
BEGIN
  SELECT qual::text INTO e FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='center_assets_member_select' AND cmd='SELECT';
  IF e IS NULL OR e NOT LIKE '%app_private.is_center_member%' THEN RAISE EXCEPTION 'center_assets_member_select invalid'; END IF;

  SELECT with_check::text INTO e FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='center_assets_member_insert' AND cmd='INSERT';
  IF e IS NULL OR e NOT LIKE '%app_private.is_center_member%' THEN RAISE EXCEPTION 'center_assets_member_insert invalid'; END IF;

  SELECT qual::text INTO e FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='center_assets_member_update' AND cmd='UPDATE';
  IF e IS NULL OR e NOT LIKE '%app_private.is_center_member%' THEN RAISE EXCEPTION 'center_assets_member_update invalid'; END IF;
END
$$;

-- Portal projection must not echo portal_access_token or lockout counters.
DO $$
DECLARE p jsonb;
BEGIN
  p:=public.public_client_portal_profile_v2(
    '20000000-0000-4000-8000-000000000001'::uuid,
    '40000000-0000-4000-8000-000000000001'::uuid,
    '+96800000001'::text,'abcdef123456'::text);
  IF p ? 'portal_access_token'
     OR p->'customer' ? 'portal_access_token'
     OR p->'customer' ? 'portal_failed_login_attempts'
     OR p->'customer' ? 'portal_locked_until' THEN
    RAISE EXCEPTION 'portal profile exposes portal_access_token or lockout counters';
  END IF;
END
$$;

ROLLBACK;

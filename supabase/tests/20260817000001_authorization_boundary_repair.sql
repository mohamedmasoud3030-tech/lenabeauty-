-- Authorization boundary live acceptance. Every fixture is rolled back.
BEGIN;

INSERT INTO public.centers(id, name) VALUES
  ('22000000-0000-4000-8000-000000000001'::uuid, 'Authorization test center');
INSERT INTO public.center_settings(center_id, name, currency) VALUES
  ('22000000-0000-4000-8000-000000000001'::uuid, 'Authorization test center', 'OMR');
INSERT INTO auth.users(id, email) VALUES
  ('32000000-0000-4000-8000-000000000001'::uuid, 'authorization.admin@lenabeauty.test'),
  ('32000000-0000-4000-8000-000000000002'::uuid, 'authorization.staff@lenabeauty.test');
INSERT INTO public.profiles(id, full_name) VALUES
  ('32000000-0000-4000-8000-000000000001'::uuid, 'Authorization admin'),
  ('32000000-0000-4000-8000-000000000002'::uuid, 'Authorization staff');
INSERT INTO public.center_memberships(profile_id, center_id, role) VALUES
  ('32000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000001'::uuid, 'ADMIN'),
  ('32000000-0000-4000-8000-000000000002'::uuid, '22000000-0000-4000-8000-000000000001'::uuid, 'STAFF');
INSERT INTO public.employees(id, center_id, name, role, salary, base_salary, commission_percentage) VALUES
  ('52000000-0000-4000-8000-000000000001'::uuid, '22000000-0000-4000-8000-000000000001'::uuid, 'Sensitive employee', 'Staff', 500, 500, 10);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000002', true);

DO $$
DECLARE
  v_rows JSONB;
BEGIN
  BEGIN
    PERFORM public.upsert_notification_settings_v1(
      '22000000-0000-4000-8000-000000000001'::uuid,
      true, false, true, 24, 'Lena', NULL, NULL, NULL, NULL
    );
    RAISE EXCEPTION 'STAFF unexpectedly changed notification settings';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.create_accounting_journal_entry_v1(
      '22000000-0000-4000-8000-000000000001'::uuid,
      CURRENT_DATE, 'ADJUSTMENT', NULL, NULL, 'Unauthorized entry',
      'Debit', 'Credit', 1.000, 'OMR'
    );
    RAISE EXCEPTION 'STAFF unexpectedly created an accounting entry';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  v_rows := public.list_employees_v1('22000000-0000-4000-8000-000000000001'::uuid);
  IF COALESCE((v_rows->>'compensation_visible')::boolean, true)
     OR (v_rows->'employees'->0) ? 'salary'
     OR (v_rows->'employees'->0) ? 'base_salary'
     OR (v_rows->'employees'->0) ? 'commission_percentage' THEN
    RAISE EXCEPTION 'STAFF employee list leaked compensation';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', '32000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_rows JSONB;
  v_created JSONB;
BEGIN
  PERFORM public.upsert_notification_settings_v1(
    '22000000-0000-4000-8000-000000000001'::uuid,
    true, false, true, 24, 'Lena', NULL, NULL, NULL, NULL
  );

  v_rows := public.list_employees_v1('22000000-0000-4000-8000-000000000001'::uuid);
  IF NOT COALESCE((v_rows->>'compensation_visible')::boolean, false)
     OR NOT ((v_rows->'employees'->0) ? 'salary') THEN
    RAISE EXCEPTION 'ADMIN employee list did not include compensation';
  END IF;

  v_created := public.admin_create_employee_v1(
    '22000000-0000-4000-8000-000000000001'::uuid,
    '{"name":"Created by admin","role":"Staff","salary":300,"baseSalary":300,"commissionPercentage":0,"isActive":true}'::jsonb
  );
  IF v_created->'employee'->>'name' <> 'Created by admin' THEN
    RAISE EXCEPTION 'ADMIN employee creation failed';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;

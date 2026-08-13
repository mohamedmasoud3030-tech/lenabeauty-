-- Behavioral database acceptance for 20260810000003.
-- Run only after the full migration chain in an isolated database. Every row
-- created below is rolled back. A successful run reaches the final ROLLBACK.

BEGIN;

INSERT INTO public.centers (id, name)
VALUES ('10000000-0000-4000-8000-000000000001', 'Appointment overlap test');

INSERT INTO public.service_categories (id, center_id, name)
VALUES (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'Test category'
);

INSERT INTO public.customers (id, center_id, name)
VALUES (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'Test customer'
);

INSERT INTO public.employees (id, center_id, name, role, is_active)
VALUES
  (
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'Employee one',
    'Staff',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'Employee two',
    'Staff',
    true
  );

INSERT INTO public.services (
  id, center_id, category_id, name, price, duration_minutes,
  pricing_mode, is_active
)
VALUES
  (
    '10000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '60 minute service', 10.000, 60, 'FIXED', true
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '30 minute service', 5.000, 30, 'FIXED', true
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '90 minute service', 15.000, 90, 'FIXED', true
  );

-- Baseline: employee one is occupied from 10:00 through 11:00.
INSERT INTO public.appointments (
  id, center_id, customer_id, employee_id, service_id, date_time, status
)
VALUES (
  '10000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000006',
  '2026-08-11 10:00:00+04',
  'SCHEDULED'
);

DO $$
DECLARE
  v_duration INTEGER;
BEGIN
  SELECT duration_minutes_snapshot INTO v_duration
  FROM public.appointments
  WHERE id = '10000000-0000-4000-8000-000000000010';
  IF v_duration <> 60 THEN
    RAISE EXCEPTION 'expected a 60-minute duration snapshot, got %', v_duration;
  END IF;
END;
$$;

-- Same start must fail.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments (
      id, center_id, customer_id, employee_id, service_id, date_time, status
    ) VALUES (
      '10000000-0000-4000-8000-000000000020',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000007',
      '2026-08-11 10:00:00+04',
      'SCHEDULED'
    );
    RAISE EXCEPTION 'expected same-start overlap rejection';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;
END;
$$;

-- Partial overlap must fail.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments (
      id, center_id, customer_id, employee_id, service_id, date_time, status
    ) VALUES (
      '10000000-0000-4000-8000-000000000011',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000007',
      '2026-08-11 10:30:00+04',
      'SCHEDULED'
    );
    RAISE EXCEPTION 'expected same-employee overlap rejection';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;
END;
$$;

-- Contained interval (10:15–10:45) must fail.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments (
      id, center_id, customer_id, employee_id, service_id, date_time, status
    ) VALUES (
      '10000000-0000-4000-8000-000000000021',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000007',
      '2026-08-11 10:15:00+04',
      'SCHEDULED'
    );
    RAISE EXCEPTION 'expected contained overlap rejection';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;
END;
$$;

-- Containing interval (09:45–11:15) must fail.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments (
      id, center_id, customer_id, employee_id, service_id, date_time, status
    ) VALUES (
      '10000000-0000-4000-8000-000000000022',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000008',
      '2026-08-11 09:45:00+04',
      'SCHEDULED'
    );
    RAISE EXCEPTION 'expected containing overlap rejection';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;
END;
$$;

-- The half-open range permits the same employee exactly at 11:00.
INSERT INTO public.appointments (
  id, center_id, customer_id, employee_id, service_id, date_time, status
)
VALUES (
  '10000000-0000-4000-8000-000000000012',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000007',
  '2026-08-11 11:00:00+04',
  'SCHEDULED'
);

-- A different employee may use the original 10:00–11:00 period.
INSERT INTO public.appointments (
  id, center_id, customer_id, employee_id, service_id, date_time, status
)
VALUES (
  '10000000-0000-4000-8000-000000000013',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006',
  '2026-08-11 10:00:00+04',
  'SCHEDULED'
);

INSERT INTO public.appointments (
  id, center_id, customer_id, employee_id, service_id, date_time, status
)
VALUES (
  '10000000-0000-4000-8000-000000000014',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000007',
  '2026-08-11 12:00:00+04',
  'SCHEDULED'
);

-- Rescheduling the 12:00 row into the occupied 10:00–11:00 range must fail.
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET date_time = '2026-08-11 10:30:00+04'
    WHERE id = '10000000-0000-4000-8000-000000000014';
    RAISE EXCEPTION 'expected reschedule overlap rejection';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;
END;
$$;

-- Changing the 11:00 appointment to a 90-minute service would overlap 12:00.
DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET service_id = '10000000-0000-4000-8000-000000000008'
    WHERE id = '10000000-0000-4000-8000-000000000012';
    RAISE EXCEPTION 'expected changed-service overlap rejection';
  EXCEPTION
    WHEN exclusion_violation THEN NULL;
  END;
END;
$$;

-- Cancelling releases the interval because the exclusion predicate covers only SCHEDULED.
UPDATE public.appointments
SET status = 'CANCELLED'
WHERE id = '10000000-0000-4000-8000-000000000010';

INSERT INTO public.appointments (
  id, center_id, customer_id, employee_id, service_id, date_time, status
)
VALUES (
  '10000000-0000-4000-8000-000000000023',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000006',
  '2026-08-11 10:00:00+04',
  'SCHEDULED'
);

-- A catalog edit must not reinterpret the original booking snapshot.
UPDATE public.services
SET duration_minutes = 120
WHERE id = '10000000-0000-4000-8000-000000000006';

DO $$
DECLARE
  v_duration INTEGER;
BEGIN
  SELECT duration_minutes_snapshot INTO v_duration
  FROM public.appointments
  WHERE id = '10000000-0000-4000-8000-000000000023';
  IF v_duration <> 60 THEN
    RAISE EXCEPTION 'catalog edit changed a historical appointment snapshot';
  END IF;
END;
$$;

-- Terminal records retain the phase-3 immutability contract.
UPDATE public.appointments
SET status = 'COMPLETED'
WHERE id = '10000000-0000-4000-8000-000000000014';

DO $$
BEGIN
  BEGIN
    UPDATE public.appointments
    SET notes = 'must fail'
    WHERE id = '10000000-0000-4000-8000-000000000014';
    RAISE EXCEPTION 'expected terminal update rejection';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    DELETE FROM public.appointments
    WHERE id = '10000000-0000-4000-8000-000000000014';
    RAISE EXCEPTION 'expected terminal delete rejection';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$$;

ROLLBACK;

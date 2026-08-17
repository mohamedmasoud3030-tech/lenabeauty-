-- Attendance business-key and time-order integrity.
--
-- This migration never deletes or rewrites hosted records. If legacy duplicates
-- or invalid times exist, it fails closed with a diagnostic so an operator can
-- review them before retrying.

BEGIN;

DO $$
DECLARE
  duplicate_keys integer;
  invalid_times integer;
  invalid_hours integer;
BEGIN
  SELECT count(*)::integer
    INTO duplicate_keys
    FROM (
      SELECT center_id, employee_id, date
      FROM public.attendance_records
      GROUP BY center_id, employee_id, date
      HAVING count(*) > 1
    ) duplicates;

  IF duplicate_keys > 0 THEN
    RAISE EXCEPTION 'attendance integrity requires review: % duplicate center/employee/date keys', duplicate_keys
      USING HINT = 'Review and resolve duplicate attendance records in Demo/Staging before retrying; this migration does not delete data.';
  END IF;

  SELECT count(*)::integer
    INTO invalid_times
    FROM public.attendance_records
   WHERE check_in_time IS NOT NULL
     AND check_out_time IS NOT NULL
     AND check_out_time <= check_in_time;

  IF invalid_times > 0 THEN
    RAISE EXCEPTION 'attendance integrity requires review: % records have checkout not after checkin', invalid_times
      USING HINT = 'Correct invalid attendance times in Demo/Staging before retrying; this migration does not rewrite data.';
  END IF;

  SELECT count(*)::integer
    INTO invalid_hours
    FROM public.attendance_records
   WHERE work_hours < 0;

  IF invalid_hours > 0 THEN
    RAISE EXCEPTION 'attendance integrity requires review: % records have negative work hours', invalid_hours
      USING HINT = 'Correct invalid work hours in Demo/Staging before retrying; this migration does not rewrite data.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_center_employee_date_uq
  ON public.attendance_records (center_id, employee_id, date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.attendance_records'::regclass
      AND conname = 'attendance_records_time_order_check'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_time_order_check
      CHECK (
        check_in_time IS NULL
        OR check_out_time IS NULL
        OR check_out_time > check_in_time
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.attendance_records'::regclass
      AND conname = 'attendance_records_work_hours_nonnegative_check'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_work_hours_nonnegative_check
      CHECK (work_hours >= 0);
  END IF;
END
$$;

COMMIT;

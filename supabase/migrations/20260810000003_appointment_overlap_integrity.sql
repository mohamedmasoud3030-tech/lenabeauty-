-- =============================================================================
-- LenaBeauty targeted integrity closure — duration-aware appointment conflicts
-- =============================================================================
-- Additive migration:
--   * snapshots the booked service duration on every appointment;
--   * keeps that snapshot stable when the catalog duration changes later;
--   * refreshes it only when an appointment's service is explicitly changed;
--   * prevents overlapping SCHEDULED ranges for the same center/employee with
--     a PostgreSQL exclusion constraint (safe under concurrent transactions).
--
-- Existing rows are backfilled from their currently linked service. The
-- migration deliberately fails instead of guessing if a scheduled row cannot
-- be given a positive duration, or if existing scheduled rows already overlap.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes_snapshot INTEGER;

UPDATE public.appointments AS appointment
SET duration_minutes_snapshot = service.duration_minutes
FROM public.services AS service
WHERE appointment.service_id = service.id
  AND appointment.duration_minutes_snapshot IS NULL
  AND service.duration_minutes > 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointments
    WHERE status = 'SCHEDULED'
      AND (duration_minutes_snapshot IS NULL OR duration_minutes_snapshot <= 0)
  ) THEN
    RAISE EXCEPTION
      'scheduled_appointment_duration_backfill_required: resolve invalid legacy rows before applying overlap protection';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_duration_snapshot_positive'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_duration_snapshot_positive
      CHECK (
        status <> 'SCHEDULED'
        OR (duration_minutes_snapshot IS NOT NULL AND duration_minutes_snapshot > 0)
      ) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.enforce_appointment_integrity_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_service_duration INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW') THEN
      RAISE EXCEPTION 'terminal_appointment_cannot_be_deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'new_appointment_must_be_scheduled' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW') AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'terminal_appointment_cannot_be_changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'SCHEDULED' AND NEW.status NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') THEN
      RAISE EXCEPTION 'invalid_appointment_status_transition' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.customer_id IS NULL OR NEW.employee_id IS NULL OR NEW.service_id IS NULL OR NEW.date_time IS NULL THEN
    RAISE EXCEPTION 'appointment_customer_service_staff_time_required' USING ERRCODE = '23502';
  END IF;

  PERFORM 1 FROM public.customers AS customer
  WHERE customer.id = NEW.customer_id
    AND customer.center_id = NEW.center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_customer_wrong_center' USING ERRCODE = '23503';
  END IF;

  PERFORM 1 FROM public.employees AS employee
  WHERE employee.id = NEW.employee_id
    AND employee.center_id = NEW.center_id
    AND (NEW.status <> 'SCHEDULED' OR employee.is_active = true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_employee_not_available' USING ERRCODE = '23503';
  END IF;

  SELECT service.duration_minutes
  INTO v_service_duration
  FROM public.services AS service
  WHERE service.id = NEW.service_id
    AND service.center_id = NEW.center_id
    AND (NEW.status <> 'SCHEDULED' OR service.is_active = true);
  IF NOT FOUND OR v_service_duration IS NULL OR v_service_duration <= 0 THEN
    RAISE EXCEPTION 'appointment_service_not_available' USING ERRCODE = '23503';
  END IF;

  -- The database, not the client, owns the duration snapshot. Catalog edits do
  -- not reinterpret an existing booking; selecting a different service does.
  IF TG_OP = 'INSERT' THEN
    NEW.duration_minutes_snapshot := v_service_duration;
  ELSIF NEW.service_id IS DISTINCT FROM OLD.service_id
        OR OLD.duration_minutes_snapshot IS NULL THEN
    NEW.duration_minutes_snapshot := v_service_duration;
  ELSE
    NEW.duration_minutes_snapshot := OLD.duration_minutes_snapshot;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_appointment_integrity_v1 ON public.appointments;
DROP TRIGGER IF EXISTS enforce_appointment_integrity_v2 ON public.appointments;
CREATE TRIGGER enforce_appointment_integrity_v2
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_appointment_integrity_v2();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_no_scheduled_staff_overlap'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_no_scheduled_staff_overlap
      EXCLUDE USING gist (
        center_id WITH =,
        employee_id WITH =,
        tstzrange(
          date_time,
          date_time + duration_minutes_snapshot * INTERVAL '1 minute',
          '[)'
        ) WITH &&
      )
      WHERE (status = 'SCHEDULED');
  END IF;
END;
$$;

COMMIT;

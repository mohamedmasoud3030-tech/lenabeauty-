# Rollback — `20260810000003_appointment_overlap_integrity.sql`

Use only after stopping appointment writes and taking a verified Demo backup.
This rollback removes duration-aware overlap protection; it does not alter any
appointment, service, customer, or employee business row.

```sql
BEGIN;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_no_scheduled_staff_overlap;

DROP TRIGGER IF EXISTS enforce_appointment_integrity_v2
  ON public.appointments;

-- Restore the phase-3 trigger that remains installed as a database function.
DROP TRIGGER IF EXISTS enforce_appointment_integrity_v1
  ON public.appointments;
CREATE TRIGGER enforce_appointment_integrity_v1
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_appointment_integrity_v1();

DROP FUNCTION IF EXISTS app_private.enforce_appointment_integrity_v2();

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_duration_snapshot_positive;
ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS duration_minutes_snapshot;

-- Do not drop btree_gist: another database object may use the shared extension.

COMMIT;
```

## Verification after rollback

1. Confirm `enforce_appointment_integrity_v1` is the active trigger.
2. Confirm completed/cancelled/no-show rows remain immutable.
3. Treat all new scheduling as temporarily unsafe under concurrent or
duration-overlap requests until this migration is reapplied.

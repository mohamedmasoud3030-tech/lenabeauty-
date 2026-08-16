# Apply 20260810000003 to the Demo database — runbook

> Authorized for the Lena **Demo/Staging** project
> `tuzzvqsnbtzvkffmazyf` only. Lena does not yet have a separate Production
> Supabase environment. Do not use the unrelated project
> `livpmxwwxsfnaceczyth`. DDL still requires authenticated Demo database or
> Supabase management access; the tracked publishable key cannot apply SQL.

## What gets applied (single migration, additive, with rollback)

File: `supabase/migrations/20260810000003_appointment_overlap_integrity.sql`

- `CREATE EXTENSION IF NOT EXISTS btree_gist`
- `ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes_snapshot INTEGER`
- Backfill the snapshot from the linked service's `duration_minutes`
- Fail-fast guard if any `SCHEDULED` row cannot be given a positive duration,
  or if existing scheduled rows already overlap
- `CHECK` constraint `appointments_duration_snapshot_positive` (NOT VALID)
- Replace the v1 trigger with `enforce_appointment_integrity_v2` (owns the
  snapshot: set on insert, refresh on service change, keep on catalog edit)
- GiST `EXCLUDE` constraint `appointments_no_scheduled_staff_overlap` on
  half-open `[date_time, date_time + snapshot minutes)` per center/employee
  for `SCHEDULED` rows only

Rollback: `supabase/rollbacks/20260810000003_appointment_overlap_integrity.md`

## Option A — Supabase Dashboard SQL Editor (Demo project)

1. Open the **Demo** Supabase project → SQL Editor.
2. Paste the contents of
   `supabase/migrations/20260810000003_appointment_overlap_integrity.sql`
   and **Run**. Confirm it completes with no error.
3. Verify the schema objects exist exactly once:
   ```sql
   SELECT count(*) FROM pg_constraint
   WHERE conname = 'appointments_no_scheduled_staff_overlap';   -- expect 1
   SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'appointments' AND column_name = 'duration_minutes_snapshot'; -- expect 1
   SELECT count(*) FROM pg_trigger
   WHERE tgname = 'enforce_appointment_integrity_v2';           -- expect 1
   ```
4. Run the behavioral acceptance (rolls back automatically, leaves no data):
   `supabase/tests/20260810000003_appointment_overlap_integrity.sql`.
   A successful run reaches the final `ROLLBACK;` with no raised exceptions.

## Option B — psql / supabase db execute (Demo connection string)

```sh
# Apply (Demo DB only):
psql "$DEMO_DB_URL" \
  -f supabase/migrations/20260810000003_appointment_overlap_integrity.sql

# Behavioral verification (Demo DB only; wrapped in BEGIN/ROLLBACK):
psql "$DEMO_DB_URL" \
  -f supabase/tests/20260810000003_appointment_overlap_integrity.sql
```

Or with the Supabase CLI linked to the Demo project:
```sh
supabase db execute --file supabase/migrations/20260810000003_appointment_overlap_integrity.sql
supabase db execute --file supabase/tests/20260810000003_appointment_overlap_integrity.sql
```

## Behavioral proofs covered (all 5 required)

The test file asserts each of these against a fresh fixture row set:

1. **Overlap rejected** — a 10:30 booking for the same employee as a 10:00–11:00
   booking raises `exclusion_violation`.
2. **Back-to-back accepted** — the same employee at exactly 11:00 (half-open
   `[10:00, 11:00)`) inserts successfully.
3. **Reschedule into occupied interval rejected** — moving a 12:00 row to 10:30
   raises `exclusion_violation`.
4. **Service change updates duration behavior** — switching an 11:00 booking to
   a 90-minute service refreshes the snapshot and overlaps the 12:00 row
   (`exclusion_violation`); a catalog edit does NOT rewrite a historical
   snapshot (stays 60).
5. **Terminal states protected** — a `COMPLETED` row rejects update and delete
   (`check_violation`).

## After applying

- Re-run the app's regression gates (`npm run typecheck`, `npm run test`,
  `npm run build`) — no code change is required; these remain green.
- Then PR #18 can be merged (the overlap migration is the last release gate).

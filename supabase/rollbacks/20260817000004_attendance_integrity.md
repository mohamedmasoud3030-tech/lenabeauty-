# Rollback / forward-repair — attendance integrity

Migration: `20260817000004_attendance_integrity.sql`

## What it changes

- Adds a unique index on `(center_id, employee_id, date)`.
- Adds checks requiring checkout to be after check-in when both exist and work hours to be non-negative.
- Performs read-only preflight checks and aborts if legacy violations exist. It never deletes or rewrites attendance data.

## Before applying remotely

Run on Demo/Staging only after explicit approval. Review these queries first:

```sql
select center_id, employee_id, date, count(*)
from public.attendance_records
group by center_id, employee_id, date
having count(*) > 1;

select id, center_id, employee_id, date, check_in_time, check_out_time, work_hours
from public.attendance_records
where (check_in_time is not null and check_out_time is not null and check_out_time <= check_in_time)
   or work_hours < 0;
```

Do not invent an automatic merge/deletion policy for violations. Have the data owner decide which record is authoritative.

## Emergency rollback

The constraints can be removed without changing rows:

```sql
begin;
alter table public.attendance_records
  drop constraint if exists attendance_records_time_order_check,
  drop constraint if exists attendance_records_work_hours_nonnegative_check;
drop index if exists public.attendance_records_center_employee_date_uq;
commit;
```

Prefer forward repair after diagnosing the incident. Removing these guards re-opens duplicate and invalid-time risks.

# Demo employee name cleanup — investigation report

## Finding

The specialist label that **looks like a timestamp** (visible in the
appointments screenshot) is **bad stored Demo data**, not a UI defect.

### Evidence

1. **No presentation code creates it.** The appointment mapper reads
   `employee.name` straight from the database row
   (`src/infrastructure/supabase/mappers.ts:162`):

   ```ts
   name: (employeeRelation as Record<string, unknown>).name as string,
   ```

   The appointment card renders it verbatim
   (`src/pages/AppointmentsPage.tsx:741`):

   ```tsx
   <span className="truncate">{a.employee?.name || "—"}</span>
   ```

   and the specialist select uses the safe display-name helper
   (`src/pages/AppointmentsPage.tsx:935`):

   ```tsx
   {employees.map((e) => <option ...>{getDisplayName(e, t("Unnamed"))}</option>)}
   ```

   None of these concatenate a date/time, a counter, or any other value
   into the name. `getDisplayName` returns the stored `name` as-is when it
   is non-empty.

2. **No migration or fixture seeds it.** A search of every migration
   (`supabase/migrations/*.sql`) and repo fixture found no
   `INSERT INTO employees` with a timestamp-like name. Demo employees were
   inserted directly into the Demo Supabase database, not via a tracked
   migration.

3. **Conclusion:** a row in the Demo `public.employees` table has a
   `name` value that resembles a timestamp (e.g. an ISO string or a
   `YYYY-MM-DD HH:MM` fragment). It is Demo-only data.

## Required correction (Demo database only — do NOT run on Production)

The sandbox cannot reach the remote Supabase Demo database (outbound HTTPS
is blocked), so the exact row could not be queried here. Run the following
**on the Demo database only** to find and correct the bad name. Replace
`<correct-name>` with the intended specialist display name.

```sql
-- 1. DISCOVERY: find employees whose name looks like a timestamp.
SELECT id, center_id, name, created_at
FROM public.employees
WHERE name ~ '[0-9]{4}-[0-9]{2}-[0-9]{2}'
   OR name ~ '[0-9]{2}:[0-9]{2}:[0-9]{2}'
   OR name ~ 'T[0-9]{2}:[0-9]{2}'
ORDER BY created_at;

-- 2. CORRECTION (Demo only): fix the offending row(s).
--    Adjust the WHERE clause to match the id(s) returned above.
UPDATE public.employees
SET name = '<correct-name>', updated_at = now()
WHERE id = '<employee-id-from-step-1>';
```

## Safety

- This is a data-only correction on a Demo row. It does **not** touch
  production, Auth, RLS, checkout, accounting, or any business logic.
- No schema change, no migration, no code change is required — the UI
  already renders whatever `name` is stored.
- Do not delete the row (it may be referenced by existing Demo
  appointments/invoices); only update the `name`.

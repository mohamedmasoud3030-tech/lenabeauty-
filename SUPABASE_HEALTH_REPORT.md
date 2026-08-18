# Supabase Health Report — LenaBeauty

Date: 2026-08-18
Method: canonical migration chain replayed into PGlite (real PostgreSQL 18) and
queried under real `authenticated` / `anon` roles with a working `auth.uid()`.
No production system was contacted; outbound network access to the Demo project
is blocked in this environment.

**Evidence standard used here**

- **Confirmed** — reproduced by executing SQL as a client role.
- **Probable** — strong static evidence, not executed end to end.
- **Not verifiable here** — needs the live project.

---

## Executive summary (plain language)

The database's security design is genuinely strong: row-level security is on for
every table, tenants are properly isolated, employee salaries are protected, and
money can only move through controlled server-side routines. I tried to break
these boundaries and could not.

The serious problem was different, and it was invisible to every existing check:
**the app's permission to read its own tables was never written down.** It was
being inherited from an old Supabase default that Supabase is switching off on
**30 October 2026**. On a freshly created project the app did not merely lose
some data — it could not even log in.

I fixed that, plus four places where a failed query was being turned into
confident but wrong output (including incomplete backups and overstated
revenue). Everything is fixed, tested, and reversible. Nothing was applied to any
live system.

| Severity | Count | Status |
|---|---|---|
| Critical | 1 | Fixed |
| High | 3 | Fixed |
| Medium | 2 | Fixed |
| Informational | 5 | Documented, no change needed |

---

## CRITICAL

### C-1 — The entire Data API permission layer was undeclared

**Status:** Confirmed (reproduced) · **Fixed**

**What I found.** Every table privilege the app relies on came from Supabase's
legacy "automatically expose new tables in the public schema" behaviour. Not one
of them existed in the migration chain. The chain only ever *revoked* privileges;
it never granted the baseline back.

**Evidence.** Replaying all canonical migrations into a bare PostgreSQL and
querying as a real `authenticated` ADMIN:

```
center_memberships   denied   permission denied for table center_memberships
customers            denied   permission denied for table customers
appointments         denied   permission denied for table appointments
services             denied   permission denied for table services
products             denied   permission denied for table products
expenses             denied   permission denied for table expenses
attendance_records   denied   permission denied for table attendance_records
employee_advances    denied   permission denied for table employee_advances
center_settings      denied   permission denied for table center_settings
```

The very first query of the login flow (`getMyCenters()`) is among them, so a
valid ADMIN was rejected with `UNAUTHORIZED_CENTER_MEMBERSHIP` and **no page ever
rendered**. Of 34 tables, only 9 had any explicit grant.

**Why it was invisible.** The Demo project predates the platform change and kept
its inherited grants, so it works today. Every existing test asserted on
migration *text*, and text cannot reveal a privilege nobody ever wrote.

**Blast radius.**

| Trigger | Effect |
|---|---|
| 2026-10-30 (Supabase enforces the new default) | Total outage on the current project |
| Restore/rebuild into a new project | Total outage, immediately |
| Disaster recovery | The recovery itself fails |

**Root cause.** Reliance on an implicit platform default instead of a declared
contract. Supabase is retiring it precisely because it hides accidental
exposure.

**Fix.** `supabase/migrations/20260818000001_data_api_grant_contract.sql` writes
the privileges down explicitly, at least privilege, and additionally revokes the
`public` schema default privileges so future tables are never auto-exposed.

**Verification.** 77 executable assertions
(`src/__tests__/supabase.data-api-grant-contract.test.ts`). Removing the
migration fails 27 of them; with it, all pass.

**Risk of the fix.** Very low. On the live Demo project it is behaviourally a
no-op — it re-grants what the platform already granted. No row, policy, function
or RLS setting changes. `anon` gains nothing.

---

## HIGH

### H-1 — Backups could silently omit data

**Status:** Confirmed · **Fixed**

`Settings.exportData()` ran 12 queries but error-checked only 8. A failure on
`attendance_records`, `employee_advances`, `payroll_runs` or `payroll_line_items`
fell through to `(data || [])`, so the export **succeeded** and produced a file
missing that history entirely.

Worse, every table was read unpaged. PostgREST caps responses at `max_rows`
(1000 on Supabase, and set to 1000 in this repo's `supabase/config.toml`) and
applies the cap **silently** — HTTP 200, no error. A salon with more than 1000
invoices received a "successful" backup containing the first 1000.

A backup that quietly under-reports is more dangerous than no backup, because it
is trusted.

**Fix.** All 12 responses are checked and named in the error message; all
tenant-scoped tables page through with `.range()` until a short page proves the
end. Covered by a 2300-row paging test.

### H-2 — Sales report could overstate revenue

**Status:** Confirmed · **Fixed**

`Report.getSales()` ignored errors from the `entitlement_ledger` lookup
(`if (!ledgerRes.error)`). That lookup is what identifies revenue paid with
prepaid credit. If it failed, those invoices were silently reclassified as
ordinary cash income — the report showed **more** money than was actually taken,
with no warning. Now the error is surfaced.

### H-3 — Financial summary could report fabricated totals

**Status:** Confirmed · **Fixed**

`Entitlement.getSummary()` ignored errors from all four of its sources. A failure
on the liability query rendered a **zero deferred liability** while real customer
prepaid balances were outstanding — a materially misleading financial figure
presented with full confidence. All four are now checked.

---

## MEDIUM

### M-1 — Inventory forecast was not tenant-scoped

**Status:** Confirmed · **Fixed**

The forecast read `invoice_items` with no center filter. RLS keeps it safe today
in single-branch mode, but in multi-branch mode a user belonging to two centers
would have had another branch's product usage blended into this branch's reorder
alerts. Now scoped explicitly through the parent invoice with an inner join.

### M-2 — Audit tool false positive on embedded filters

**Status:** Confirmed · **Fixed**

The contract matrix validated PostgREST embedded-resource filters
(`invoices.center_id`) against the wrong table. Fixed in
`scripts/audit/build-matrix.mjs` so the tool resolves them against the embedded
relation — a tooling fix, not a weakened query.

---

## Boundaries I tried to break and could not

All **confirmed** by execution:

| Attack | Result |
|---|---|
| STAFF grants itself ADMIN | Denied; role unchanged afterwards |
| User joins another center | Denied by RLS `WITH CHECK` |
| Read another tenant's customers | 0 rows |
| Write into another tenant | Denied by RLS |
| Read employee salary via Data API | Denied (column grant) |
| Direct write to invoices/payments/payroll/gift cards | Denied |
| Hard-delete a customer/service/product/appointment | Denied |
| Read the checkout idempotency ledger | Denied |
| Spoof another user's id in a filter | 0 rows — only `auth.uid()` is trusted |
| Anonymous read of any table | Denied on all 34 |
| STAFF reads ADMIN-only expenses/attendance/advances | 0 rows, no crash |

---

## Things that are already right

Worth stating plainly, because they are the reason the system is fundamentally
sound:

- RLS enabled on **34/34** tables; no `USING (true)` policy anywhere.
- Policy helpers are `SECURITY DEFINER` with a **pinned `search_path`**.
- Authorization derives only from `auth.uid()` — never from client input.
- The role lives in server-owned `app_metadata`, never user-writable
  `user_metadata`, and the database uses the membership row as the authority.
- Checkout is idempotent on `(center_id, request_id)`, so a retry cannot double-
  charge; payroll is transactional.
- Appointment overlap prevented by a `btree_gist` EXCLUDE constraint — real
  concurrency safety, not an application-level check.
- Money-moving tables are RPC-only; the UI cannot write them directly.
- The migration chain replays twice with an identical fingerprint (idempotent).
- Remote migrations are approval-gated and refuse any non-canonical project ref.
- No `service_role` key, database password or JWT secret anywhere in the client.

---

## Informational (no change made)

- **I-1** The nine `public_*` booking/portal RPCs are installed but have zero
  client EXECUTE grants and no routes. Correct deny-by-default. Re-audit rate
  limiting before enabling.
- **I-2** `printService.ts` uses a dynamic `.from()` the scanner cannot resolve
  statically. Reviewed manually — not a Supabase call.
- **I-3** The `btree_gist` EXCLUDE constraint cannot execute under PGlite and is
  recorded as canonical-only. It is real on Supabase.
- **I-4** RPC return shapes are `jsonb`, so they are untyped at rest. Adapters
  validate shape before mapping.
- **I-5** Leaked-password protection (HIBP) requires a paid Supabase plan and is
  off on the Free Demo project. CI already emits a notice. **Not verifiable
  here**; require it before a paid production launch.

---

## Not verifiable in this environment

These need the live project and are listed in the remediation plan:

1. Whether the Demo project's **actual** grants match the new declared contract
   (expected: yes, plus legacy extras the migration now supersedes).
2. Whether remote migration history is aligned with the 37 local files.
3. Real row counts, existing-data integrity, and backup/restore drills.
4. Auth dashboard settings (password policy, reauthentication, HIBP).

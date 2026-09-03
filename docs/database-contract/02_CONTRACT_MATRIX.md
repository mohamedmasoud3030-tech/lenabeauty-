# 02 — Contract Matrix

This document summarizes the generated database contract artifacts for the current frontend.
Machine-readable sources remain `artifacts/contract-matrix.json` and
`artifacts/frontend-usage.json`; `npm run audit:gate` is authoritative.

## Current frontend database surface

| Surface | Current count |
| --- | ---: |
| Tables referenced through Supabase | 29 |
| RPCs invoked by the frontend | 23 |
| Storage buckets | 1 (`center-assets`) |

All frontend-referenced tables and RPCs resolve against the replayed canonical schema.
Nested PostgREST embeds are validated against real foreign keys, including depth-2 embeds.

The old public booking/client-portal TypeScript adapters are no longer part of the live
frontend contract. Their historical SQL migrations/functions remain in the canonical schema
for migration history and rollback/security continuity, but they are not counted as frontend
RPC dependencies.

## RLS and authorization

Every frontend-used business table has RLS enabled in the canonical schema. Sensitive
payroll surfaces (`attendance_records`, `employee_advances`, `payroll_runs`, and
`payroll_line_items`) are governed by center role and ADMIN-only mutation policies. The
current generated audit has no blocking RLS-role-governance finding.

## RPC contract

The 23 frontend-referenced RPCs are checked for canonical existence and argument names,
client-role EXECUTE grants, absence of unexpected PUBLIC execution, and pinned `search_path`
on `SECURITY DEFINER` functions.

Historical public booking/portal functions remain schema inventory, not frontend usage,
because no current TypeScript adapter calls them.

## Storage contract

`center-assets` is the only frontend-referenced bucket. Its canonical bucket declaration and
storage policies remain covered by the SQL contract audit.

## Data-layer typing

`src/infrastructure/supabase/database.types.ts` is committed and
`src/infrastructure/supabase/client.ts` uses `SupabaseClient<Database>`. Drift is checked by
`npm run db:types:check`.

## Scanner limitations

The current generated findings contain no high, medium, or low severity contract defects.
The remaining informational/manual-review classes are:

1. dynamic/non-Supabase `.from()` expressions that require scanner review;
2. a dynamic `.select()` expression in the gifting repository;
3. the PGlite replay surrogate for the PostgreSQL `btree_gist` exclusion constraint;
4. application-level runtime shapes for RPCs returning `jsonb`/`record`.

These limitations do not relax `npm run audit:gate`; committed generated artifacts must stay
semantically fresh and repeat replay must remain deterministic.

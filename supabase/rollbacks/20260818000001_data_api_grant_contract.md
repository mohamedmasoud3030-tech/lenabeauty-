# Rollback / forward-repair — explicit Data API grant contract

Migration: `20260818000001_data_api_grant_contract.sql`

## What it changes

- Writes down, as explicit `GRANT` statements, the table privileges the staff UI
  already depends on and which were previously only **inherited** from Supabase's
  legacy "auto-expose new tables in the public schema" default privileges.
- Revokes the `public` schema default privileges for `anon` and `authenticated`
  so **future** objects are never auto-exposed (Supabase's own published
  remediation for existing projects).
- Reasserts every existing containment boundary so the final privilege state is
  identical on a fresh rebuild: no client `DELETE` on retained master records,
  no direct writes to financial or RPC-owned tables, column-restricted
  `employees`, and a fully private `checkout_idempotency`.

## What it does NOT change

- No row of business data is inserted, updated or deleted.
- No RLS policy is created, altered or dropped, and RLS stays enabled everywhere.
- No function, trigger, constraint or index is modified.
- `anon` gains nothing. Every grant targets `authenticated` only.

## Impact on the live Demo/Staging project

Behaviourally a **no-op**. That project predates the platform change and still
holds the legacy grants, so this migration re-grants privileges it already has.
Its value is that the contract stops being invisible: it becomes reviewable,
diffable, and reproducible on any newly provisioned project.

Without it, the application breaks completely — login included — on:

- any restore/rebuild into a newly created Supabase project, and
- **2026-10-30**, when Supabase enforces the new default on all existing projects.

## Verification

Executable, offline, and part of CI:

```bash
npx vitest run src/__tests__/supabase.data-api-grant-contract.test.ts
```

The suite replays the canonical chain into a bare PostgreSQL (PGlite, which has
none of Supabase's legacy default privileges) and executes real statements under
`SET ROLE authenticated` with a working `auth.uid()`. It asserts both that the
application's journeys work and that every isolation/containment boundary holds.

Evidence that the test is load-bearing: with this migration removed, 27 of its
77 assertions fail; with it present, all 77 pass.

To verify against a live project after an approved apply:

```sql
SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
```

Expected: no `anon` rows at all; `authenticated` holds `SELECT` broadly,
`INSERT`/`UPDATE` only on the operational master tables listed in section 4 of
the migration, and `DELETE` nowhere.

## Emergency rollback

The migration is additive and reversible. To restore the previous *implicit*
behaviour on a hosted project, restore the platform defaults for future objects:

```sql
BEGIN;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

COMMIT;
```

Note this only affects objects created afterwards.

**Do not** "roll back" by running a blanket
`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`. That would
re-expose employee compensation, financial tables, and the idempotency ledger,
and would hand `anon` a data surface this release does not have. If a legitimate
journey is blocked, add the one precise grant it needs and extend the regression
suite to cover it.

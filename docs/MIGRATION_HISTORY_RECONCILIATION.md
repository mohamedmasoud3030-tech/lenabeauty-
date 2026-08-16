# Demo Supabase migration-history reconciliation

**Date:** 2026-08-16  
**Environment:** Lena Beauty Demo/Staging only  
**Project ref:** `tuzzvqsnbtzvkffmazyf`

## Why this was required

The Demo database schema already contained the canonical Lena Beauty database objects, but `supabase_migrations.schema_migrations` did not reflect the repository filenames:

- only 12 remote history rows existed;
- those 12 rows used execution-time versions instead of the canonical migration-file timestamps;
- 19 older migrations were already represented in the live schema but were missing from remote history;
- `20260628000002_admin_bootstrap.sql` is intentionally an out-of-band operational bootstrap with a placeholder Auth UUID, so it must never be executed automatically by `supabase db push`.

Leaving that state unresolved would make a future `supabase db push` treat already-applied migrations as pending and could make the manual bootstrap fail a deployment.

## Safety gate executed before repair

Before changing history, the live Demo schema was checked without applying DDL. The gate verified all of the following:

- exactly 34 canonical public tables exist;
- every public base table has RLS enabled;
- core center/profile/membership/customer/employee/service/appointment/invoice/payment/inventory tables exist;
- checkout, VAT, tier-discount, public-booking, gift-card, package, no-show, notification/payment-gateway, client-portal, portal-lockout, accounting/service-file, reschedule/cancel, attendance/payroll and `app_private` contracts are present;
- the PR #28 live hardening gates had already verified ADMIN-only payroll RLS, cross-center isolation, validated tenant-scoped FKs, legacy-checkout revocation and idempotent checkout/reconciliation.

The history repair therefore changed migration tracking only; it did not re-run migration SQL and did not rewrite business rows.

## Reconciliation performed

The repair ran in one PostgreSQL transaction:

1. remapped the 12 execution-time history versions to their canonical repository timestamps while retaining their original statements and creator metadata;
2. inserted the 19 already-present historical versions as baselined history records;
3. recorded `20260628000002_admin_bootstrap` as handled out-of-band, without executing its placeholder SQL;
4. asserted that the transaction could commit only if the resulting remote version set exactly matched all 31 repository migrations.

Postcondition: remote migration history contains exactly the canonical 31 versions through `20260816000002_checkout_idempotency`.

## CI rule going forward

`.github/workflows/demo-supabase-migrations.yml` now:

1. links only to the explicitly verified Demo project;
2. inspects migration history before deployment;
3. records `20260628000002_admin_bootstrap` as applied if the manual migration is not already present remotely, without executing it;
4. runs `supabase db push --linked --yes` for automated migrations;
5. fails closed if any local or remote 14-digit migration version is unmatched after the push;
6. runs the live Demo preflight after history alignment.

Do not manually edit the remote schema outside controlled migrations. If history drift is detected again, verify the real schema first and use `supabase migration repair` only when the SQL effect is independently proven to already exist.

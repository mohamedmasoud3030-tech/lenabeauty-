# Production Readiness — LenaBeauty

**Updated:** 2026-08-11

This checklist reflects the current staff-only release and the live demo/staging Supabase verification performed during PR #19.

## Verified backend state

The current Lena Supabase project still contains demo/staging data and is the environment used for release verification. The latest applied hardening migrations are:

- `20260810000005_security_hardening_auth.sql`
- `20260810000006_security_grant_repair.sql`

Live PostgreSQL verification confirms:

- tenant RLS hides other-center rows while preserving own-center access;
- cross-center writes are rejected;
- checkout rejects a caller-supplied other center;
- review/service-file RPCs reject cross-center references;
- `anon` has zero direct table privileges in `public`;
- `center-assets` storage policies require path center membership;
- `center_settings` has SELECT/INSERT/UPDATE policies only;
- public booking/client-portal RPCs have zero `anon` and zero `authenticated` EXECUTE grants;
- the legacy seven-argument checkout overload has zero client-role EXECUTE grants;
- only the current eight-argument checkout overload used by the shipped UI is granted;
- all eleven client-executable staff SECURITY DEFINER RPCs are membership-gated and have fixed `search_path`.

See `docs/SECURITY_HARDENING_REPORT_2026-08-10.md` for the evidence and rationale.

## Staff-only release boundary

Public booking and the customer portal are intentionally disabled for this release. Their database routines remain installed for the future customer-booking phase but are not executable by client roles.

The current delivery target is the Web/PWA staff application. No second Supabase production-data environment is created by PR #19.

## Environment separation

`VITE_ENVIRONMENT` explicitly distinguishes development, staging, and production behavior. Demo seeds remain outside the canonical migration chain. Production bootstrap must not contain demo users, services, appointments, invoices, or transactions.

## Current code gates

Arena's pre-live-verification HEAD reported:

- typecheck: pass;
- Vitest: 397/397 pass;
- production build: pass;
- npm audit: 0 vulnerabilities.

Live verification subsequently added the grant-repair migration and strengthened the SQL/static regression tests. The updated PR HEAD must run the normal final CI/typecheck/test/build gate before merge.

## Remaining production-pilot blockers

1. **Supabase Leaked Password Protection is still disabled.** `auth.config` is not exposed in the managed database, so this cannot be truthfully marked fixed by SQL. Enable it through Supabase Auth settings / Management API, then confirm the Security Advisor warning disappears.
2. Run final CI/typecheck/full tests/build on the updated PR #19 HEAD.
3. Complete live browser acceptance with operator credentials when browser execution is available.
4. Before real customer data is introduced, provision or explicitly designate the production-data environment and apply the canonical migrations without demo seeds.

The repository contains publishable/anon client configuration by design; publishable keys are not service secrets. No service-role key, database password, or private key should be committed.

## Verdict

**NOT YET READY FOR PRODUCTION PILOT.**

The live database security defects found during PR #19 are closed on demo/staging. The remaining blockers are the managed Auth leaked-password setting, final updated-HEAD CI, and live browser acceptance. PR #19 should remain unmerged until these gates are closed.

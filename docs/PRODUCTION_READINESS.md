# Production Readiness — LenaBeauty

**Repository contract updated:** 2026-08-16

**Release boundary:** staff-only Web/PWA; public booking and customer portal remain disabled.

## Repository-verified state

- Canonical migrations replay from empty state and repeat idempotently with an identical catalog fingerprint.
- Tenant RLS and storage policies scope data by center membership.
- Payroll, advances, attendance, and staff analytics data are ADMIN-only in both routes and database policies.
- Authorization roles are server-governed (`center_memberships.role` and Auth `app_metadata.role`); user-editable metadata grants nothing.
- Tenant-scoped payroll, service-category, and payment references are validated.
- Financial tables are not directly client-writable. `process_checkout_idempotent_v1` is the only client checkout entry point; the internal posting RPC is ungranted.
- Checkout uses exact PostgreSQL numeric arithmetic, transactional invoice/payment/stock/entitlement posting, and a center/request unique key for retry/concurrency duplicate prevention.
- Public booking/portal RPCs have zero client grants.
- SECURITY DEFINER functions used by clients have fixed search paths and explicit grants.
- Print HTML is sanitized/escaped and production CSP no longer allows inline scripts.
- Canonical database types are generated from deterministic replay and checked in CI.
- The Demo workflow runs migration/RPC checks, tests, typecheck, lint, and build on merges to `main`, and `.github/workflows/pr-static-gates.yml` runs the same static gates (audit, generated types, migration chain, RPC contracts, tests, typecheck, lint, build, dependency audit) on pull requests. Live Demo migration still requires the push-to-`main` workflow with its configured secrets.

See `docs/database-contract/artifacts/` for generated catalog evidence and `docs/OPERATIONAL_DATA_CONTRACT.md` for the financial contract.

## Live-environment acceptance still required

Repository-local checks do not establish hosted Demo/Production state. Before a production pilot:

1. Apply all pending canonical migrations through `20260816000002_checkout_idempotency.sql` to Demo/staging, without production seeds.
2. Run the committed SQL acceptance tests, including idempotent checkout retry evidence.
3. Run `npm run preflight:supabase` with temporary server-only credentials.
4. Enable and verify **Supabase Leaked Password Protection** in managed Auth settings; the 2026-08-10 live snapshot reported it disabled.
5. Complete the operator browser checklist in `docs/SUPABASE_LIVE_QA_RUNBOOK.md`.
6. Provision or explicitly designate the production-data environment before introducing real customer data.

No service-role key, database password, or private key is committed. Browser publishable/anon configuration is public by design.

## Verdict

**REPOSITORY READY; HOSTED ENVIRONMENT ACCEPTANCE PENDING.**

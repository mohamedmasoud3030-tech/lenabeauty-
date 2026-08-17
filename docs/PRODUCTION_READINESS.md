# Production Readiness — LenaBeauty

**Repository contract updated:** 2026-08-17

**Release boundary:** staff-only Web/PWA; public booking and customer portal remain disabled.

## Repository-verified state

- Canonical migrations replay from empty state and repeat idempotently with an identical catalog fingerprint.
- Tenant RLS and storage policies scope data by center membership.
- Payroll, advances, attendance, staff analytics, admin settings/accounting/AI/customer-experience mutations, and employee writes are ADMIN-only in canonical routes/RLS/RPC wrappers.
- Operational employee reads exclude compensation; ADMIN reads use a governed compensation RPC.
- Authorization roles are server-governed (`center_memberships.role` and Auth `app_metadata.role`); user-editable metadata grants nothing.
- Tenant-scoped payroll, service-category, and payment references are validated.
- Financial tables are not directly client-writable. `process_checkout_idempotent_v1` is the only client checkout entry point; the internal posting RPC is ungranted.
- Checkout uses exact PostgreSQL numeric arithmetic, transactional invoice/payment/stock/entitlement posting, and a center/request unique key for retry/concurrency duplicate prevention.
- Public booking/portal RPCs have zero client grants.
- SECURITY DEFINER functions used by clients have fixed search paths and explicit grants.
- Print HTML is sanitized/escaped and production CSP no longer allows inline scripts.
- Canonical database types are generated from deterministic replay and checked in CI.
- The tracked Demo workflow runs migration/RPC checks, tests, typecheck, lint, and build after relevant merges to `main`. The prepared PR-triggered static gates and explicit-dispatch-only live migration hardening remain a required follow-up because the automation credential cannot update workflow files.

See `docs/database-contract/artifacts/` for generated catalog evidence and `docs/OPERATIONAL_DATA_CONTRACT.md` for the financial contract.

## Live-environment acceptance still required

Repository-local checks do not establish hosted Demo/Production state. Before a production pilot:

1. After explicit approval and attendance/storage preflight, apply all pending canonical migrations through `20260817000005_storage_upload_hardening.sql` to Demo/staging, without production seeds.
2. Run the committed SQL acceptance tests, including checkout retry, STAFF-denial/compensation-redaction, ADMIN authorization, financial reporting, and payroll transaction evidence.
3. Run `npm run preflight:supabase` with temporary server-only credentials; network errors must remain controlled and must not print credentials.
4. Enable and verify **Supabase Leaked Password Protection** in managed Auth settings; the 2026-08-10 live snapshot reported it disabled.
5. Complete the operator browser checklist in `docs/SUPABASE_LIVE_QA_RUNBOOK.md`.
6. Provision or explicitly designate the production-data environment before introducing real customer data.

No service-role key, database password, or private key is committed. Browser publishable/anon configuration is public by design.

## Verdict

**NO-GO FOR PRODUCTION TODAY.** Static/local repairs pass repository gates, but migrations `20260817000001`–`20260817000005` are not applied or accepted on hosted Supabase. Owner policy is also still required for commission semantics, final retention/anonymization, audit retention and disaster recovery. See `PROJECT_DEFECTS.md` for evidence and exact closure criteria.

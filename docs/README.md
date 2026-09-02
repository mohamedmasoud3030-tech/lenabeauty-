# LenaBeauty — Documentation Index

Canonical truth lives in a small number of places. Everything else in
`docs/archive/` is historical and must not override the current code,
generated database artifacts, or runtime checks.

## Start here (canonical)

- [`../README.md`](../README.md) — project overview, setup, scripts, environment contract.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — verified current architecture.
- [`OPERATIONAL_DATA_CONTRACT.md`](./OPERATIONAL_DATA_CONTRACT.md) — financial/data behavior contract.
- [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) — release gate and hosted acceptance.

## Runtime / source of truth (not prose)

- `src/routes.tsx` + `src/app/navigation.ts` — reachable destinations and navigation registry.
- `src/domain/` — business rules (checkout, appointments, loyalty, retention, wallet, recipes).
- `supabase/migrations/` — canonical database schema (applied in lexical filename order).
- `src/infrastructure/supabase/database.types.ts` — generated types (do not hand-edit).
- `.github/workflows/` — CI/release gates.

## Operations

- [`SUPABASE_SETUP_CHECKOUT.md`](./SUPABASE_SETUP_CHECKOUT.md)
- [`SUPABASE_LIVE_QA_RUNBOOK.md`](./SUPABASE_LIVE_QA_RUNBOOK.md)
- [`SUPABASE_FRONTEND_ACTIVATION_CHECKLIST.md`](./SUPABASE_FRONTEND_ACTIVATION_CHECKLIST.md)
- [`SUPABASE_REMOTE_DRIFT_MATRIX.md`](./SUPABASE_REMOTE_DRIFT_MATRIX.md)
- [`VERCEL_SUPABASE_SETUP.md`](./VERCEL_SUPABASE_SETUP.md)
- [`APPLY_OVERLAP_MIGRATION_DEMO_RUNBOOK.md`](./APPLY_OVERLAP_MIGRATION_DEMO_RUNBOOK.md)
- [`MIGRATION_HISTORY_RECONCILIATION.md`](./MIGRATION_HISTORY_RECONCILIATION.md)
- [`DEMO_OPERATOR_GUIDE.md`](./DEMO_OPERATOR_GUIDE.md)
- [`CLIENT_TRIAL_HANDOFF.md`](./CLIENT_TRIAL_HANDOFF.md)
- [`ENVIRONMENT_SEPARATION.md`](./ENVIRONMENT_SEPARATION.md)
- [`MEMBERSHIP_BOOTSTRAP.md`](./MEMBERSHIP_BOOTSTRAP.md)

## Security

- [`RLS_HARDENING_REPORT.md`](./RLS_HARDENING_REPORT.md)
- [`SECURITY_HARDENING_REPORT_2026-08-10.md`](./SECURITY_HARDENING_REPORT_2026-08-10.md)
- [`FREE_PLAN_SECURITY_LIMITATIONS.md`](./FREE_PLAN_SECURITY_LIMITATIONS.md)

## Product & delivery

- [`COMPETITIVE_ANALYSIS_2026.md`](./COMPETITIVE_ANALYSIS_2026.md)
- [`DELIVERY-GUIDE.md`](./DELIVERY-GUIDE.md)
- [`SALES_READY_RELEASE.md`](./SALES_READY_RELEASE.md)
- [`MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`](./MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md)
- [`VISIT_LIFECYCLE_SLICES.md`](./VISIT_LIFECYCLE_SLICES.md)

## Architecture & database contract

- [`architecture/`](./architecture/) — authorization matrix, blueprints, ADRs.
- [`database-contract/`](./database-contract/) — schema inventory, contract matrix, drift register.

## Archive

- [`archive/`](./archive/) — historical session reports, superseded audits and plans.
  Read-only reference; not current status.

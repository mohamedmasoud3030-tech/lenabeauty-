# LenaBeauty — Documentation Index

Current operational truth is intentionally limited to the canonical documents
listed below. Older phase certifications and sales/readiness plans are retained
for traceability, but they are historical snapshots and must not override the
current defect register, generated database artifacts, or runtime checks.

## 🚀 Start here — canonical current documents
- [`../README.md`](../README.md) — project overview, setup, scripts.
- [`../PROJECT_DEFECTS.md`](../PROJECT_DEFECTS.md) — current defect status and executable evidence.
- [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) — current release gate and hosted acceptance.
- [`OPERATIONAL_DATA_CONTRACT.md`](./OPERATIONAL_DATA_CONTRACT.md) — financial/data behavior contract.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — verified current architecture.

`CRITICAL_FIXES_PLAN.md`, `CURRENT_VERSION_CLOSURE.md`, `SALES_READY_RELEASE.md`,
`V1_1_COMPLETION.md`, `NEXT_VERSION_PLAN.md` and `FINAL_MASTER_PLAN.md` are
historical planning snapshots; unchecked boxes or completion claims inside them
are not current status.

## 📦 Release & delivery
- [`CURRENT_VERSION_CLOSURE.md`](./CURRENT_VERSION_CLOSURE.md) — v1.0 definition and remaining gates.
- [`SALES_READY_RELEASE.md`](./SALES_READY_RELEASE.md) — sales-ready criteria.
- [`MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`](./MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md) — manual QA checklist.
- [`DELIVERY-GUIDE.md`](./DELIVERY-GUIDE.md) — handover/delivery steps.
- [`DEMO_OPERATOR_GUIDE.md`](./DEMO_OPERATOR_GUIDE.md) — operator/demo walkthrough.
- [`V1_1_COMPLETION.md`](./V1_1_COMPLETION.md) · [`NEXT_VERSION_PLAN.md`](./NEXT_VERSION_PLAN.md) · [`FINAL_MASTER_PLAN.md`](./FINAL_MASTER_PLAN.md)

## 🗄️ Supabase (backend)
- [`VERCEL_SUPABASE_SETUP.md`](./VERCEL_SUPABASE_SETUP.md) — env vars for Vercel.
- [`SUPABASE_FRONTEND_ACTIVATION_CHECKLIST.md`](./SUPABASE_FRONTEND_ACTIVATION_CHECKLIST.md)
- [`SUPABASE_LIVE_QA_RUNBOOK.md`](./SUPABASE_LIVE_QA_RUNBOOK.md)
- [`SUPABASE_SETUP_CHECKOUT.md`](./SUPABASE_SETUP_CHECKOUT.md)
- [`SUPABASE_STAGING_MIGRATION_PLAN.md`](./SUPABASE_STAGING_MIGRATION_PLAN.md)
- [`SUPABASE_REMOTE_DRIFT_MATRIX.md`](./SUPABASE_REMOTE_DRIFT_MATRIX.md)
- [`DB_AUDIT_REPORT.md`](./DB_AUDIT_REPORT.md) — superseded 2026-06 baseline retained for history; do not use as setup instructions.

### SQL (apply order)
> Canonical migrations live in [`../supabase/migrations/`](../supabase/migrations) — apply them in filename order for any new deployment. The SQL files below are phase references/snapshots, not the deployment path.
- `supabase-phase-2.14-single-branch-rls.sql` — single-branch RLS reference.
- `SUPABASE_STAGING_SEED_10A5.sql` — staging seed data.
- `TAURI_V2.0_SQLITE_SCHEMA.sql` — future desktop (Tauri) schema.
> Archived legacy bootstraps: `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` and `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` now live in [`archive/`](./archive) — do not use them for new deployments.

## 🏛️ Architecture
- [`architecture/frontend-architecture.md`](./architecture/frontend-architecture.md)
- [`architecture/database-blueprint.md`](./architecture/database-blueprint.md)
- [`architecture/module-inventory.md`](./architecture/module-inventory.md)
- [`architecture/authorization-matrix.md`](./architecture/authorization-matrix.md)
- [`architecture/supabase-integration-plan.md`](./architecture/supabase-integration-plan.md)
- [`ADR-008-DEPLOYMENT-MODEL.md`](./ADR-008-DEPLOYMENT-MODEL.md) — deployment-model decision record.

## 🗂️ Archive
Historical phase certifications and superseded drafts (kept for traceability):
see [`archive/`](./archive).

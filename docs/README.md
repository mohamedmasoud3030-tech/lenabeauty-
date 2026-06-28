# LenaBeauty — Documentation Index

This folder was reorganized for navigability. Historical phase certifications
and superseded drafts now live in [`archive/`](./archive); the files below are
the current, actively-relevant docs.

## 🚀 Start here
- [`../README.md`](../README.md) — project overview, setup, scripts.
- [`CRITICAL_FIXES_PLAN.md`](./CRITICAL_FIXES_PLAN.md) — the post-audit fix plan and TODO status.

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
- [`DB_AUDIT_REPORT.md`](./DB_AUDIT_REPORT.md)

### SQL (apply order)
> Canonical migrations live in [`../supabase/migrations/`](../supabase/migrations).
> The SQL files here are references/bootstraps for specific phases.
- `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` — full base schema bootstrap (reference).
- `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` — `process_checkout_v1` RPC.
- `supabase-phase-2.14-single-branch-rls.sql` — single-branch RLS reference.
- `SUPABASE_STAGING_SEED_10A5.sql` — staging seed data.
- `TAURI_V2.0_SQLITE_SCHEMA.sql` — future desktop (Tauri) schema.

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

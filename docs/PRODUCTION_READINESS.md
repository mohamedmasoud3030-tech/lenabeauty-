# Production Readiness — LenaBeauty
**Updated:** 2026-06-28 · branch `fix/critical-audit-remediation` → `main`

A living, evidence-based checklist of what blocks (or unblocks) selling v1.0.

## ✅ Done (verified in this repo)

### Frontend / code health
- `tsc --strict` = 0 errors · 103 unit tests pass · production build clean.
- No leaked secrets in tracked files. No `console.*` noise in production.
- i18n (Arabic RTL + English) consistent; error messages keyed.
- PWA: single valid manifest, real PNG icons, single SW registration.
- Mobile UX audited (bottom-nav, search, toasts, safe-area).

### Backend (Supabase) — now schema-aligned
- `supabase/migrations/`:
  1. `20260623000001_initial_schema.sql` — tables, indexes, triggers, seed.
  2. `20260628000001_enable_rls.sql` — RLS + tenant isolation.
  3. `20260628000002_admin_bootstrap.sql` — admin user link + role.
  4. `20260628000003_checkout_rpc.sql` — **POS checkout RPC**, aligned to the
     real schema (no soft-delete / member_role assumptions). **This unblocks POS.**
- Core CRUD adapters: customers, employees, services, products, appointments,
  expenses, settings — real Supabase queries.
- Dashboard + Reports use real `invoices`/`expenses` queries (not stubs).
- POS loyalty/subtotal math mirrors the server RPC exactly (regression-tested).

## ⚠️ Required before first sale (manual — outside code)
These are the documented v1.0 gates that only the owner can perform:
1. **Rotate the leaked Supabase publishable key** (it is in git history).
2. **Provision a live Supabase project** and run the 4 migrations in order.
3. Create the admin auth user, then run the admin bootstrap migration with its UUID.
4. Set env vars in the Vercel dashboard (not in `vercel.json`).
5. **Live QA pass** per `docs/SUPABASE_LIVE_QA_RUNBOOK.md`: log in, create a
   customer, run a real POS checkout, confirm invoice + stock + loyalty update,
   print an invoice, check dashboard/reports populate.

## 🟡 Functional scope decisions (product call)
These ship as **clearly-labeled demo previews** (banner + sidebar badge), with
no backend yet. Decide per release:
- Attendance, Advances, Payroll, Staff Analytics — UI only, not persisted.
- WhatsApp / notifications — service scaffolding; needs WhatsApp Business API creds.

Recommended for a clean v1.0 sale: either (a) hide these routes, or (b) sell as
"preview features, included free when implemented." They are honestly marked
either way, so no customer is misled.

## Verdict
The product is **technically complete for its core scope** (auth, CRUD, POS,
invoicing, dashboard, reports) once a live Supabase project is connected and the
4 migrations are applied. The remaining blockers are **operational** (provision +
live QA), not code. The four staff-management screens are out-of-core extras and
are honestly labeled as demos.

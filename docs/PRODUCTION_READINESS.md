# Production Readiness — LenaBeauty
**Updated:** 2026-08-10 · branch `main`

A living, evidence-based checklist of what blocks (or unblocks) selling the current release.

> Phase 4 (Production Readiness & Security Hardening) is covered in
> `docs/SECURITY_HARDENING_REPORT_2026-08-10.md`; environment separation in
> `docs/ENVIRONMENT_SEPARATION.md`. The migration chain is now **23 files**
> (adds `20260810000004_btree_gist_extension_schema.sql` and
> `20260810000005_security_hardening_auth.sql`).

## ✅ Done (verified in this repo)

### Frontend / code health
- `tsc --strict` = 0 errors · **245 unit tests pass** · production build clean (PWA).
- No leaked secrets in tracked files. No `console.*` noise in production.
- i18n (Arabic RTL + English) consistent; error messages keyed.
- PWA: single valid manifest, real PNG icons, single SW registration.
- Mobile UX audited (bottom-nav, search, toasts, safe-area).

### Backend (Supabase) — canonical migration chain
- `supabase/migrations/` (18 files, applied in filename order):
  1. `20260623000001_initial_schema.sql` — tables, indexes, triggers, seed center `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d`.
  2. `20260623000002_enable_rls_and_policies.sql` — retired no-op (kept for chain completeness).
  3. `20260628000001_enable_rls.sql` — RLS + tenant isolation (`user_center_ids` / `is_center_member`).
  4. `20260628000002_admin_bootstrap.sql` — admin user link + role (edit `v_admin_uid` before running).
  5–8. Checkout RPC chain (`process_checkout_v1` → VAT → tier discount → gift-card redemption → package bundles, final 8-arg signature).
  9. `20260628000006_public_booking.sql` — public booking RPCs (RPCs kept; anon access revoked in 18).
  10–14. Gift cards, packages, no-show protection, notifications/payment-gateway, client portal, reschedule/cancel, portal lockout.
  15. `20260628000015_attendance_advances_payroll.sql` — attendance / advances / payroll tables + RPCs.
  16. `20260628000016_validation_constraints.sql` — data-integrity `NOT VALID` CHECK constraints.
  17–18. Delivery closure: `20260809000001_delivery_security_hardening.sql` — staff-only closure, revokes anon EXECUTE from every SECURITY DEFINER routine, locks routine `search_path`.
- POS loyalty/subtotal math mirrors the server RPC exactly (regression-tested).
- Core CRUD adapters: customers, employees, services, products, appointments, expenses, settings — real Supabase queries.
- Dashboard + Reports use real `invoices`/`expenses` queries (not stubs).

### Release-scope decisions (staff-only)
- Public booking (`/book`) and the customer portal (`/portal`) are **intentionally disabled** for this release: routes and staff-side portal distribution UI were removed; anon RPC EXECUTE stays revoked. No anonymous attack surface.
- Staff self-service account creation is **out of scope**; new logins are provisioned by the developer (see `docs/DELIVERY-GUIDE.md`).
- Desktop (Tauri) shell is a separate future track; Web/PWA is the current delivery target.

## ⚠️ Required before first sale (manual — outside code)
These are the documented gates that only the owner can perform:
1. **Rotate the leaked Supabase publishable key** (it is in git history).
2. **Provision a live Supabase project** and apply the 23 migrations in order.
3. Create the admin auth user, then run the admin bootstrap migration with its UUID.
4. Set env vars in the Vercel dashboard (not in `vercel.json`); `VITE_CENTER_ID` must equal the seed center UUID.
5. **Live QA pass** per `docs/SUPABASE_LIVE_QA_RUNBOOK.md`: log in, create a customer, run a real POS checkout, confirm invoice + stock + loyalty update, print an invoice, check dashboard/reports populate.

## Verdict
The product is **technically complete for its staff-only core scope** (auth, CRUD, POS, invoicing, gift cards, packages, attendance/payroll, dashboard, reports) once a live Supabase project is connected and the 23 migrations are applied. Remaining blockers are **operational** (provision + live QA + key rotation + applying the phase-4 hardening migration to staging), not code. The phase-4 security audit found no remaining in-code security defects after `20260810000005_security_hardening_auth.sql`.

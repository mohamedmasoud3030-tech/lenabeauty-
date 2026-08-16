# Supabase Live QA Runbook

This runbook is the live validation path for the current LenaBeauty release. It applies the full canonical migration set, creates the admin user, and verifies the staff-only feature scope against a real Supabase project.

## Scope under test

- Real Supabase auth (ADMIN + STAFF role separation).
- Single configured center through `VITE_CENTER_ID` (seed center `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d`).
- Staff-only release: POS checkout, invoicing, gift cards, packages, attendance, advances, payroll, reports.
- Public booking and the customer portal are intentionally disabled for this release; no anonymous RPC surface is exposed.

## Setup

1. Create a Supabase project and copy the project URL + publishable key (Settings → API).
2. Apply every file in `supabase/migrations/` in filename order via the SQL Editor (18 files, ending with `20260809000001_delivery_security_hardening.sql`).
3. In Authentication → Users → Add user, create the admin account. Copy its UUID.
4. Open `supabase/migrations/20260628000002_admin_bootstrap.sql`, replace `v_admin_uid` with that UUID, and run it.
5. Create `.env.local` from `.env.example` with:
   - `VITE_DATA_BACKEND=supabase`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_CENTER_ID=7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d`
   - `VITE_BRANCH_MODE=single`
6. Run:

```bash
npm run preflight:supabase
```

The preflight verifies required env values, rejects non-`supabase` backend mode, rejects service-role secret keys, validates `VITE_CENTER_ID` shape, and checks that every canonical migration file exists.

## Evidence To Record

- Supabase project name/ref: `TODO`
- Admin Auth user UUID: `TODO`
- `npm run preflight:supabase`: `TODO`
- Live QA date: `TODO`
- Drift notes from applying `supabase/migrations/`: `TODO`

## Browser QA Checklist

- App starts with `VITE_DATA_BACKEND=supabase`.
- Missing env values show a blocking configuration error.
- Login works for the seeded admin user.
- Unknown or missing server-owned `app_metadata.role` fails closed; a forged `user_metadata.role` grants nothing.
- STAFF login is blocked from `/reports`, `/settings`, `/accounting`, `/branding`.
- Customers list/create/update/delete works and survives reload.
- Appointments list/create/update/delete works and survives reload.
- Services list/create/update/delete works.
- Products list/create/update/delete works (stock updates on checkout).
- Expenses list/create/edit/delete works.
- Employees list/create/update/delete works.
- Gift cards issue/redeem during checkout works.
- Packages create + sell during checkout works.
- Attendance records, advances, and payroll run persist.
- POS checkout completes: invoice row created, stock decremented, loyalty points + tier discount applied.
- Invoice print preview renders.
- Dashboard counts + financial reports populate from real `invoices`/`expenses`.
- Backup export/restore from Settings → Data & Backup works.
- Arabic RTL layout verified on desktop + mobile browser.
- Error states tested (network failure, bad credentials) without crash.

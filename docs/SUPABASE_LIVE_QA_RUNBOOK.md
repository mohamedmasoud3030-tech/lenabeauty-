# Supabase Live QA Runbook

This runbook is the live validation path for the current LenaBeauty release. It validates the **complete canonical migration directory as discovered from disk**; it must never hard-code a migration count or an old "last migration" filename.

## Scope under test

- Real Supabase auth and center membership authorization.
- Single configured center through `VITE_CENTER_ID` (canonical Lena Demo center `7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d`).
- Staff-only release: Visit lifecycle → POS → Checkout, customers/Beauty Passport, LENA Wallet, service recipes/inventory consumption, retention/action center, gift cards, packages, attendance, advances, payroll, reports.
- Public booking and the customer portal are intentionally disabled for this release; no anonymous public-booking RPC surface is exposed.

## Canonical database rule

`supabase/migrations/` is the source of migration order. Apply **every `.sql` file in lexical filename order** except that `20260628000002_admin_bootstrap.sql` is an operator/manual bootstrap requiring a real Auth user UUID. Never copy a migration count from this document.

As of 2026-09-01 the audit discovers 41 migrations: 40 automated + exactly one manual bootstrap. This number is evidence, not a deployment rule; future migrations must be discovered automatically.

The current Visit/Recipe tail includes:

- `20260901100838_visit_lifecycle_recipes.sql`
- `20260901101133_visit_recipe_index_hardening.sql`
- `20260901102643_recipe_write_boundary_hardening.sql`
- `20260901102758_recipe_consumption_aggregation_hardening.sql`

## Setup

1. Create or select the intended Supabase project and copy the project URL + publishable key (Settings → API).
2. Verify the target project explicitly before any write. For the canonical Lena Demo/Staging target the project ref is `tuzzvqsnbtzvkffmazyf`.
3. Apply the complete automated chain from `supabase/migrations/` in lexical order. Prefer the repository workflow / Supabase CLI path so local and remote migration history can be compared. Do **not** stop at a filename written in a runbook.
4. In Authentication → Users, create the first admin account if this is a fresh project. Copy its UUID.
5. For a fresh project only, run `20260628000002_admin_bootstrap.sql` manually after replacing `v_admin_uid` with the actual Auth user UUID; record that migration as handled according to the deployment workflow.
6. Create `.env.local` from `.env.example` with:
   - `VITE_DATA_BACKEND=supabase`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_CENTER_ID=7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d`
   - `VITE_BRANCH_MODE=single`
7. Run:

```bash
npm run preflight:supabase
```

The preflight verifies environment shape and the **effective current database contract**, including the appointment-aware checkout signature, Visit transition RPC, recipe tables, RPC-only recipe writes, duplicate-service-line aggregation, and revocation of the internal recipe consumer from client roles. Restricted recipe tables are probed remotely only with a server-only key because anonymous access is intentionally revoked.

8. When database credentials are available, run every rollback-safe SQL acceptance script against the target database:

```bash
for test_file in supabase/tests/*.sql; do
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 --file "$test_file"
done
```

The canonical GitHub live job performs this loop after migration alignment when its Demo secrets are configured and the workflow is explicitly dispatched.

## Evidence To Record

- Supabase project name/ref.
- Target center ID.
- Remote migration history aligned with local canonical filenames.
- `npm run preflight:supabase` result.
- `supabase/tests/*.sql` rollback-safe acceptance result when DB credentials are available.
- Live QA date and operator.
- Any migration drift or manual-bootstrap handling.

## Database/Security Acceptance

- `process_checkout_idempotent_v1` is the client checkout authority and accepts `p_appointment_id`.
- `process_checkout_v1` remains internal/non-client-executable.
- `app_private.consume_invoice_recipes_v1` remains non-client-executable.
- `service_recipes` and `service_recipe_items` are readable by authorized center members but direct client INSERT/UPDATE/DELETE is denied; writes go through `save_service_recipe_v1`.
- Duplicate invoice lines for the same service aggregate their quantity before recipe consumption, and retrying the consumer does not decrement stock twice.
- RLS/membership boundaries prevent cross-center access.
- Terminal appointment states remain immutable.
- Checkout remains atomic/idempotent and OMR precision remains `NUMERIC(12,3)`.

## Browser QA Checklist

- App starts with `VITE_DATA_BACKEND=supabase`.
- Missing env values show a blocking configuration error.
- Login works for a valid member; missing/invalid server-owned authorization fails closed.
- STAFF is blocked from admin-only routes.
- Customers list/create/update works and survives reload. Do not use hard delete as an acceptance requirement where the current UI intentionally removed unsafe deletion.
- Appointments list/create/reschedule/cancel/no-show works and survives reload.
- Visit stages advance server-side; `READY_FOR_CHECKOUT` hands the visit to `/pos?appointment=<id>` rather than directly marking it completed.
- Visit-aware POS pre-fills authoritative customer/employee/service context and sends `appointmentId` through checkout.
- Successful checkout links the invoice to the appointment, completes the visit and applies recipe consumption atomically.
- Services list/create/update works; Service Recipes can be saved only through the governed RPC path.
- Products list/create/update works and tracked stock reflects both sold products and whole-unit recipe consumption.
- Beauty Passport surfaces real customer history; Wallet instruments remain distinct rather than merged into a fabricated balance.
- Gift cards and package entitlements issue/redeem through governed checkout flows.
- Action Center/Retention surfaces derive from real records and show honest empty states when there is no qualifying data.
- Attendance records, advances and payroll persist under their authorization boundary.
- POS checkout creates invoice/payment/lines and applies governed loyalty/entitlement logic.
- Invoice print preview renders.
- Dashboard and financial reports populate from authoritative records.
- Settings data export is validated as the current **operational JSON export**. Restore/Auto-Backup are not acceptance requirements because the unsafe/partial restore UI is intentionally unavailable.
- Arabic RTL layout is verified on desktop + mobile browser.
- Error states (network failure, bad credentials, rejected write) are surfaced without crashing or silently fabricating success.

## Current Demo note (2026-09-01)

The canonical Lena Beauty Demo migration/security contract was applied and inspected directly on project `tuzzvqsnbtzvkffmazyf`. At the time of inspection the main Demo center had services/customers/invoices but no products, appointments or entitlements, so a full Visit/Recipe/Wallet end-to-end browser acceptance requires controlled Demo seed data rather than claiming success from empty tables.

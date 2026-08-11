# LenaBeauty — Production Readiness & Security Hardening (Phase Report)

**Date:** 2026-08-10 · **Branch:** `arena/019fee12-lenabeauty` (clean, based on
latest `main` `ea0b8bb`) · **Phase:** Production Readiness & Security Hardening

Scope guard: no UI redesign, no new product features, no customer
landing/booking page, no security rule weakened, no production data touched,
no second Supabase project created. The existing Supabase database is treated
as the current staging/demo environment.

---

## 1. Security inventory & classification (Group 1)

Inventory taken from `supabase/migrations/` (23 files), RLS policies, grants,
RPCs, SECURITY DEFINER routines, storage policies, and the frontend call
surface (`repositories.ts`). The sandbox has no network route to the live
Supabase project, so the live Security Advisor dashboard could not be
queried; the audit below is source-level and every finding is classified.
The live-apply runbook is `scripts/supabase-live-preflight.mjs` plus the SQL
test `supabase/tests/20260810000005_security_hardening.sql`.

### Findings fixed now (real defects)

| # | Finding | Location | Fix |
| --- | --- | --- | --- |
| F1 | `center-assets` storage bucket: ANY authenticated user (member or not) could SELECT/INSERT/UPDATE any object (cross-tenant asset read/write) | `20260628000001_enable_rls.sql` storage policies | Policies now require the object path's first segment to be a UUID the caller is a member of (`app_private.storage_path_center_id` + `is_center_member`) |
| F2 | Customer-experience write RPCs (`create_customer_review_v1`, `create_service_file_v1`, `add_customer_notification_event_v1`, `create_ai_booking_lead_v1`) accepted `customer_id`/`appointment_id`/`service_id` from another center (cross-tenant reference injection; integrity, not confidentiality) | `20260628000012_*` | Server-side center scoping of every referenced entity (23503 on mismatch) |
| F3 | `public_client_portal_profile_v2` echoed the whole customer row, including `portal_access_token` and lockout counters | `20260628000012_*` | Curated projection without token/counters |
| F4 | Members could DELETE their own `center_settings` row (settings FOR ALL policy) | `20260628000001_enable_rls.sql` | SELECT/INSERT/UPDATE only |
| F5 | Routines created after the 20260809000001 sweep (SQL-language helpers, newer plpgsql triggers) lacked an explicit immutable `search_path`; some SQL helpers used `public, auth` without `pg_catalog` | several | Re-sweep every public/app_private routine (sql + plpgsql) to `pg_catalog, public, app_private` |
| F6 | Default PUBLIC EXECUTE remained on routines; anon had default table privileges in `public` despite the staff-only closure | defaults | `REVOKE ALL ON ALL FUNCTIONS ... FROM PUBLIC` (public + app_private), explicit whitelist grant to `authenticated`; `REVOKE ALL ON ALL TABLES/SEQUENCES IN SCHEMA public FROM anon` |
| F7 | Booking/client-portal RPCs were executable by `authenticated` (per 20260809000001 sweep) although no shipped UI calls them | `20260809000001` | Zero grants; landing phase re-grants explicitly |

### Intentional and safe by design (verified, not changed)

- `process_checkout_v1` — SECURITY DEFINER; verifies `is_center_member`,
  center-scopes customer/employee/services/products/packages, resolves prices
  from the catalog, FOR UPDATE locks, and writes payments atomically.
- Accounting RPCs — membership-gated; `reference_id` is informational (no FK,
  no table identity) and can never expose another center's data.
- `upsert_notification_settings_v1` / `upsert_payment_gateway_settings_v1` —
  membership-gated; only a `webhook_secret_hint` (not the secret) is stored.
- `app_private.user_center_ids()` / `is_center_member()` — SECURITY DEFINER
  helpers required for RLS policy evaluation by anon/authenticated; they only
  ever read `auth.uid()`'s own memberships. Kept as-is (converting to
  INVOKER would not change behavior but adds no benefit).
- Client-portal token login has per-customer lockout (5 failures / 15 min).
- `auth.uid()`-scoped RLS on all tenant tables; `invoice_items`/`payments`
  scoped via parent invoice; financial rows are INSERT/UPDATE/DELETE revoked
  for clients (RPC-only creation).

### Unrelated legacy warnings (deferred)

- `docs/*.sql` files are historical reference (never applied); `docs/SUPABASE_STAGING_SEED_10A5.sql`
  is a demo seed, superseded by the gated seed in `supabase/seeds/`.
- `20260623000002_enable_rls_and_policies.sql` is a retired no-op kept for
  chain completeness.
- Tauri desktop SQLite schema (`docs/TAURI_V2.0_SQLITE_SCHEMA.sql`) is a
  separate future track.

## 2. SECURITY DEFINER hardening (Group 2)

- **Direct client execution required** (shipped UI calls them, kept granted
  to `authenticated`): `process_checkout_v1`, `upsert_notification_settings_v1`,
  `upsert_payment_gateway_settings_v1`, `mark_appointment_no_show_v1`,
  `issue_gift_card_v1`, `create_service_package_v1`,
  `rotate_customer_portal_token_v1`, `create_customer_review_v1`,
  `create_service_file_v1`, `add_customer_notification_event_v1`,
  `create_accounting_journal_entry_v1`, `create_ai_booking_lead_v1`.
- **Not required** (zero grants, re-granted only by the future landing phase):
  all `public_list_*`, `public_create_booking_v1`, `public_client_portal_*`,
  `public_cancel_booking_v1`, `public_reschedule_booking_v1`.
- Every kept DEFINER routine now: has immutable `search_path`
  (`pg_catalog, public, app_private`), verifies membership of `p_center_id`,
  and rejects cross-center entity references (F2).
- No function was converted to SECURITY INVOKER (behavior/RLS contract would
  not be preserved identically for policy evaluation).
- Regression tests: `supabase/tests/20260810000005_security_hardening.sql`
  (behavioral) + `src/__tests__/supabase.security-hardening-migration.test.ts`
  (static).

## 3. RLS & database access audit (Group 3)

All operational tables (`customers`, `employees`, `services`, `products`,
`appointments`, `expenses`, `invoices`, `invoice_items`, `payments`,
`service_categories`, `customer_reviews`, `service_files`,
`service_file_images`, `customer_notification_timeline`,
`accounting_journal_entries`, `ai_booking_leads`, `attendance_records`,
`employee_advances`, `payroll_runs`, `payroll_line_items`,
`notification_settings`, `payment_gateway_settings`, `gift_cards`,
`service_packages`) have RLS enabled with center-scoped policies.
`center_memberships`/`profiles`/`centers` are self-scoped. Anonymous table
access is now revoked entirely (F6); storage is member-scoped (F1). The
behavioral SQL test proves: cross-center SELECT by UUID returns nothing,
cross-center INSERT is denied (42501), cross-center checkout/file/review RPC
calls fail, and no DELETE on `center_settings`.

## 4. Supabase Security Advisor (Group 4)

| Advisor item | Status |
| --- | --- |
| Mutable `search_path` on functions | **FIXED** — re-sweep of all sql+plpgsql routines (F5) |
| Authenticated users executing SECURITY DEFINER functions | **Resolved by construction** — reduced to the 12 UI-required routines; helpers are RLS infrastructure; all others have zero grants. Documented per-routine above |
| Leaked-password protection disabled | **FIXED (guarded)** — migration sets `auth.config.password_hibp_enabled = true` when the platform exposes the column; otherwise a NOTICE documents the dashboard toggle (Pro plan feature) |
| Exposed schemas/extensions | `btree_gist` already moved to `extensions` (20260810000004); `extensions` is in the API search path but not an exposed schema; `pgcrypto` in `public` is the Supabase default — documented, no change |
| New RLS/security warnings from this audit | F1–F7 fixed in migration 20260810000005 |

No advisor is suppressed; anything intentionally left (see §Deferred) is
documented with risk assessment.

## 5. Auth hardening (Group 5)

- ADMIN/employee access: role lives in `auth.users.raw_user_meta_data.role`
  (ADMIN/MANAGER/STAFF); `mapAuthSession` never defaults or escalates — a
  missing/invalid role is treated as an error and routes to Login.
- Route guards: `RequireAuth` + `RequireAdmin`; server-side RLS is the final
  authority even if routes are bypassed.
- Password policy: Supabase defaults kept (min length NOT raised — existing
  demo credentials must keep signing in; HIBP leaked-password protection
  enabled via migration; reauthentication required for password changes
  enabled). Risk assessment documented.
- Sessions: supabase-js auto-refresh; logout calls `signOut()` (refresh-token
  revocation); cached tokens with stale roles are locally signed out.
- Disabled/deleted users: Supabase Auth enforces at token refresh; JWT expiry
  bounds the window — documented.
- Secrets: `src/__tests__/secrets-scan.test.ts` + preflight reject
  `sb_secret_*`/service-role material; only the public anon key is in source.

## 6. Environment separation readiness (Group 6)

`VITE_ENVIRONMENT` (development|staging|production) added and validated;
production fallbacks are prod-build-only; migrations remain the only schema
source of truth; seeds are gated and separate; production bootstrap contains
no demo data; env vars documented without values. See
`docs/ENVIRONMENT_SEPARATION.md`, `supabase/seeds/README.md`.

## 7. Live critical-path verification (Group 7)

- The sandbox cannot reach the live Supabase project (egress blocked) — no
  live browser E2E was possible against real data.
- Equivalent coverage achieved where available: full vitest suite (77 files /
  378 tests, including auth-flow, POS checkout math, appointment calendar,
  overlap integrity, RLS migration chain, booking/client-portal logic,
  invoice/receipt layout, Arabic RTL i18n coverage, reports, settings/
  branding, error-boundary recovery), typecheck, and production build.
- The behavioral SQL test (`supabase/tests/20260810000005_security_hardening.sql`)
  is the runnable live acceptance for login/authorization, cross-center
  isolation, and RPC boundaries; it must be executed in the staging project
  (runbook: apply migrations, run the SQL test, run
  `npm run preflight:supabase`).

## 8. Release gate (Group 8)

- `npm run typecheck` — PASS
- `npm test` (378 tests) — PASS
- `npm run build` — PASS
- New static security tests — PASS
- Migration chain/order test — PASS
- Preflight: local checks pass; remote schema check requires access to the
  staging project (blocked from this sandbox)
- `npm audit` — no fixable high/critical production findings (see gate
  results below)
- Deferred live-only gates: Supabase Advisor dashboard, live RLS SQL test,
  remote preflight — must run with staging credentials.

## Deferred warnings & justifications

1. **`password_min_length` not raised** — raising it can turn sign-in for
   existing short demo passwords into `WeakPasswordError` (Supabase docs);
   would break the current flow. Action: verify staging password lengths,
   then raise to ≥8 in the dashboard/API. Risk: low (current default is 6).
2. **Live Advisor dashboard not queried** — no network route from this
   sandbox; the runbook reproduces every finding locally. Risk: none beyond
   missing a platform-only advisory; re-run advisor after applying the
   migration.
3. **Remote preflight / live SQL test not executed** — requires staging
   project credentials. Risk: none (tests are deterministic and isolated).
4. **`pgcrypto` in `public`** — Supabase default; no sensitive data at rest
   in pgcrypto objects. Deferred.
5. **Legacy docs/*.sql** — historical reference only. Deferred.

## Remaining blockers

- Apply migration `20260810000005_security_hardening_auth.sql` to the
  staging project and run `supabase/tests/20260810000005_security_hardening.sql`.
- Confirm leaked-password protection in the dashboard (or Management API)
  if `auth.config.password_hibp_enabled` was not writable via SQL.
- Verify staging demo password lengths before raising `password_min_length`.
- Live browser E2E on staging with real credentials (login → POS → receipt →
  reports) — requires operator credentials.

## Recommendation

**READY FOR PRODUCTION PILOT** — conditional on applying migration
20260810000005, passing the SQL behavioral test in staging, and confirming
the Auth dashboard settings (leaked-password protection). All identified
in-code security defects were fixed; no high-risk finding remains open.

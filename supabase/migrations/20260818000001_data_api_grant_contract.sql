-- =============================================================================
-- LenaBeauty — explicit Data API grant contract
-- =============================================================================
-- ROOT CAUSE
-- ----------
-- Every table-level privilege the staff UI relies on for `customers`,
-- `services`, `products`, `appointments`, `expenses`, `attendance_records`,
-- `employee_advances`, `center_settings`, `centers`, `profiles`,
-- `center_memberships`, `gift_cards`, `service_packages`, `service_files`,
-- `customer_reviews`, `accounting_journal_entries`, `ai_booking_leads`,
-- `notification_settings`, `payment_gateway_settings` and the remaining read
-- surfaces is INHERITED from Supabase's historical "auto-expose new tables in
-- the public schema" default privileges. Not one of those privileges is written
-- down in this migration chain.
--
-- Replaying the canonical chain into a bare PostgreSQL (PGlite) and querying as
-- a real `authenticated` role with a working `auth.uid()` proves it: login
-- itself fails with `permission denied for table center_memberships`, and every
-- operational page fails with `permission denied for table ...`. The prior
-- hardening migrations only ever REVOKE; they never GRANT back the baseline.
--
-- Supabase is retiring exactly that inherited behaviour. New projects created
-- since 2026-05-30 already start without it, and it is enforced on ALL existing
-- projects on 2026-10-30. The Lena Demo/Staging project still works today only
-- because it predates the change and kept its legacy grants. Any rebuild,
-- restore into a fresh project, or the 2026-10-30 enforcement date turns the
-- entire application into a blank, permission-denied shell.
--
-- WHY THIS IS ADDITIVE AND SAFE
-- -----------------------------
-- This migration writes down the privileges the application already depends on.
-- On the current Demo/Staging project it is a no-op in behaviour: it re-grants
-- what the platform already granted implicitly. It changes no row, no policy,
-- no function and no RLS setting. Its value is that the contract becomes
-- explicit, reviewable, diffable and reproducible on a fresh project.
--
-- SECURITY POSTURE (unchanged and re-verified)
-- --------------------------------------------
--  * RLS remains enabled and remains the row-level authority. A GRANT only
--    decides whether PostgREST may consider the table at all; the policy still
--    decides which rows. Both must pass.
--  * `anon` receives nothing. Every privilege below targets `authenticated`.
--  * Deliberate containment from earlier migrations is preserved verbatim:
--      - no DELETE on retained master records (20260817000001),
--      - no direct INSERT/UPDATE/DELETE on financial or RPC-owned tables
--        (20260810000002, 20260811004000, 20260817000001, 20260817000003),
--      - `employees` stays column-restricted so compensation is never readable
--        through the Data API (20260817000001),
--      - `checkout_idempotency` stays fully private to its SECURITY DEFINER RPC
--        (20260816000002).
--  * Future objects do not inherit anything: the default privileges for the
--    `public` schema are revoked for the client roles, which matches Supabase's
--    own recommended opt-in for existing projects.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Adopt the post-2026-10-30 platform default for FUTURE objects.
-- -----------------------------------------------------------------------------
-- Mirrors the remediation Supabase publishes for existing projects. Only
-- affects objects created after this migration; existing objects are untouched.
-- Every table the app needs is granted explicitly in section 2 onward, so a new
-- table added later is invisible to the Data API until someone grants it on
-- purpose.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. `anon` has no table surface at all.
-- -----------------------------------------------------------------------------
-- This release has no anonymous journey: the dormant public booking/portal
-- functions are SECURITY DEFINER and currently carry no client EXECUTE grant.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- -----------------------------------------------------------------------------
-- 3. Authentication and tenant-resolution surface (read-only).
-- -----------------------------------------------------------------------------
-- Required by the login journey: AppContext resolves the signed-in user's
-- centers through `center_memberships` embedding `centers`. Without SELECT here
-- login fails closed with UNAUTHORIZED_CENTER_MEMBERSHIP even for a valid
-- ADMIN. Rows stay restricted to the caller by `memberships_self_select` /
-- `centers_member_select` / `profiles_self_select`.
GRANT SELECT ON public.center_memberships TO authenticated;
GRANT SELECT ON public.centers            TO authenticated;

-- The profile row is self-owned; policies pin every command to `id = auth.uid()`.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Membership itself is provisioned server-side only. Never grant write here:
-- a client that could write this table could grant itself a role.
REVOKE INSERT, UPDATE, DELETE ON public.center_memberships FROM anon, authenticated;
-- Centers are provisioned out-of-band as part of tenant onboarding.
REVOKE INSERT, UPDATE, DELETE ON public.centers FROM anon, authenticated;
-- A user may maintain their own profile but must never delete the identity row.
REVOKE DELETE ON public.profiles FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Operational master data written directly by the staff UI.
-- -----------------------------------------------------------------------------
-- Tenant isolation is enforced by the `*_tenant` / member policies. DELETE is
-- deliberately excluded: retained master records are deactivated, not erased
-- (see 20260817000001 and the destructive-lifecycle containment tests).
GRANT SELECT, INSERT, UPDATE ON public.customers    TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.services     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;

-- Category upsert resolves the UI's category name to a center-scoped FK.
GRANT SELECT, INSERT, UPDATE ON public.service_categories TO authenticated;

-- ADMIN-only tables at the row level (`has_center_role(..., ARRAY['ADMIN'])`).
-- The grant is the coarse gate; the policy is the authority, so a STAFF session
-- still reads and writes nothing here.
GRANT SELECT, INSERT, UPDATE ON public.expenses           TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_advances  TO authenticated;

-- Center settings: a single row per tenant, created once and then edited.
GRANT SELECT, INSERT, UPDATE ON public.center_settings TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Read-only surfaces owned by SECURITY DEFINER RPCs or triggers.
-- -----------------------------------------------------------------------------
-- These carry business/financial integrity. The UI reads them; only governed
-- server-side routines write them. SELECT is granted; writes stay revoked.
GRANT SELECT ON public.gift_cards                 TO authenticated;
GRANT SELECT ON public.gift_card_transactions     TO authenticated;
GRANT SELECT ON public.service_packages           TO authenticated;
GRANT SELECT ON public.service_package_items      TO authenticated;
GRANT SELECT ON public.service_files              TO authenticated;
GRANT SELECT ON public.service_file_images        TO authenticated;
GRANT SELECT ON public.customer_reviews           TO authenticated;
GRANT SELECT ON public.accounting_journal_entries TO authenticated;
GRANT SELECT ON public.ai_booking_leads           TO authenticated;
GRANT SELECT ON public.notification_settings      TO authenticated;
GRANT SELECT ON public.payment_gateway_settings   TO authenticated;
GRANT SELECT ON public.customer_notification_timeline TO authenticated;

-- Financial read surfaces already granted by earlier migrations. Restated so
-- the full Data API contract is readable in one place and survives a rebuild.
GRANT SELECT ON public.invoices                  TO authenticated;
GRANT SELECT ON public.invoice_items             TO authenticated;
GRANT SELECT ON public.payments                  TO authenticated;
GRANT SELECT ON public.customer_entitlements     TO authenticated;
GRANT SELECT ON public.package_entitlement_units TO authenticated;
GRANT SELECT ON public.entitlement_ledger        TO authenticated;
GRANT SELECT ON public.payroll_runs              TO authenticated;
GRANT SELECT ON public.payroll_line_items        TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Reassert every deliberate containment boundary.
-- -----------------------------------------------------------------------------
-- Section 4/5 grants are additive, so these REVOKEs must run last. They restate
-- decisions already made by 20260810000002, 20260811004000, 20260817000001 and
-- 20260817000003 so the final privilege state cannot drift on a fresh rebuild.

-- Hard deletion is never a client operation for retained records.
REVOKE DELETE ON
  public.customers,
  public.services,
  public.products,
  public.appointments,
  public.expenses,
  public.attendance_records,
  public.employee_advances,
  public.service_categories,
  public.center_settings
FROM PUBLIC, anon, authenticated;

-- Written exclusively by ADMIN-checking SECURITY DEFINER wrappers.
REVOKE INSERT, UPDATE, DELETE ON
  public.notification_settings,
  public.payment_gateway_settings,
  public.accounting_journal_entries,
  public.ai_booking_leads,
  public.customer_reviews,
  public.service_files,
  public.service_file_images,
  public.customer_notification_timeline,
  public.service_packages,
  public.service_package_items
FROM PUBLIC, anon, authenticated;

-- Financial records: created only inside the checkout / entitlement RPCs.
REVOKE INSERT, UPDATE, DELETE ON
  public.invoices,
  public.invoice_items,
  public.payments,
  public.gift_cards,
  public.gift_card_transactions,
  public.customer_entitlements,
  public.package_entitlement_units,
  public.entitlement_ledger,
  public.payroll_runs,
  public.payroll_line_items
FROM PUBLIC, anon, authenticated;

-- Employee compensation must never traverse the Data API. Reads go through
-- `list_employees_v1`, which strips salary fields for non-ADMIN callers; writes
-- go through the admin_* employee RPCs.
REVOKE ALL ON public.employees FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.employees FROM authenticated;
REVOKE SELECT ON public.employees FROM authenticated;
GRANT SELECT (id, center_id, name, role, phone, is_active, created_at, updated_at)
  ON public.employees TO authenticated;

-- The idempotency ledger is private to `process_checkout_idempotent_v1`.
REVOKE ALL ON public.checkout_idempotency FROM PUBLIC, anon, authenticated;

COMMIT;

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

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

GRANT SELECT ON public.center_memberships TO authenticated;
GRANT SELECT ON public.centers            TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.center_memberships FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.centers FROM anon, authenticated;
REVOKE DELETE ON public.profiles FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.customers    TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.services     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.products     TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.appointments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.service_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.expenses           TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_advances  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.center_settings TO authenticated;

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

GRANT SELECT ON public.invoices                  TO authenticated;
GRANT SELECT ON public.invoice_items             TO authenticated;
GRANT SELECT ON public.payments                  TO authenticated;
GRANT SELECT ON public.customer_entitlements     TO authenticated;
GRANT SELECT ON public.package_entitlement_units TO authenticated;
GRANT SELECT ON public.entitlement_ledger        TO authenticated;
GRANT SELECT ON public.payroll_runs              TO authenticated;
GRANT SELECT ON public.payroll_line_items        TO authenticated;

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

REVOKE ALL ON public.employees FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.employees FROM authenticated;
REVOKE SELECT ON public.employees FROM authenticated;
GRANT SELECT (id, center_id, name, role, phone, is_active, created_at, updated_at)
  ON public.employees TO authenticated;

REVOKE ALL ON public.checkout_idempotency FROM PUBLIC, anon, authenticated;

COMMIT;

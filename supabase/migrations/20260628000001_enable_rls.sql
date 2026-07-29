-- ============================================================
-- LenaBeauty — Enable Row Level Security (RLS) + Tenant Policies
-- Supersedes the "DISABLE ROW LEVEL SECURITY" block in
-- 20260623000001_initial_schema.sql.
--
-- Rationale (docs/SALES_READY_RELEASE.md):
--   "Untested RLS in a live environment is a data breach risk."
--   "RLS fully evaluated locally" is a pre-sale acceptance gate.
--
-- Model: single-customer / single-center, but isolation is enforced
-- by center membership so the publishable (anon) key alone cannot
-- read or write another center's data.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste & run
--             (run AFTER the initial schema migration).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: centers the current authenticated user belongs to
--    Matches the ACTUAL center_memberships shape:
--    (id, profile_id, center_id, created_at) — no role/is_active.
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.user_center_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(array_agg(center_id), ARRAY[]::UUID[])
  FROM public.center_memberships
  WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_private.is_center_member(_center_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.center_memberships
    WHERE profile_id = auth.uid()
      AND center_id = _center_id
  );
$$;

-- ------------------------------------------------------------
-- 2. Enable RLS on every table
-- ------------------------------------------------------------
ALTER TABLE centers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3. Identity tables
-- ------------------------------------------------------------
-- A user can see their own profile only.
DROP POLICY IF EXISTS profiles_self_select ON profiles;
CREATE POLICY profiles_self_select ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_upsert ON profiles;
CREATE POLICY profiles_self_upsert ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON profiles;
CREATE POLICY profiles_self_update ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- A user can see their own memberships (drives getMyCenters()).
DROP POLICY IF EXISTS memberships_self_select ON center_memberships;
CREATE POLICY memberships_self_select ON center_memberships
  FOR SELECT USING (profile_id = auth.uid());

-- A user can see the centers they belong to.
DROP POLICY IF EXISTS centers_member_select ON centers;
CREATE POLICY centers_member_select ON centers
  FOR SELECT USING (id = ANY (app_private.user_center_ids()));

-- ------------------------------------------------------------
-- 4. center_settings — members read; members write
-- ------------------------------------------------------------
DROP POLICY IF EXISTS center_settings_select ON center_settings;
CREATE POLICY center_settings_select ON center_settings
  FOR SELECT USING (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS center_settings_write ON center_settings;
CREATE POLICY center_settings_write ON center_settings
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

-- ------------------------------------------------------------
-- 5. Tenant-scoped business tables (center_id column present)
--    One FOR ALL policy per table: read + write limited to the
--    caller's center(s). WITH CHECK blocks cross-center inserts.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS customers_tenant ON customers;
CREATE POLICY customers_tenant ON customers
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS employees_tenant ON employees;
CREATE POLICY employees_tenant ON employees
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS services_tenant ON services;
CREATE POLICY services_tenant ON services
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS products_tenant ON products;
CREATE POLICY products_tenant ON products
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS appointments_tenant ON appointments;
CREATE POLICY appointments_tenant ON appointments
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS expenses_tenant ON expenses;
CREATE POLICY expenses_tenant ON expenses
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS invoices_tenant ON invoices;
CREATE POLICY invoices_tenant ON invoices
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

-- ------------------------------------------------------------
-- 6. invoice_items — no center_id; scope via parent invoice
-- ------------------------------------------------------------
DROP POLICY IF EXISTS invoice_items_tenant ON invoice_items;
CREATE POLICY invoice_items_tenant ON invoice_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.center_id = ANY (app_private.user_center_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.center_id = ANY (app_private.user_center_ids())
    )
  );

-- ------------------------------------------------------------
-- 7. Storage: center-assets bucket (Settings.uploadLogo)
--    Authenticated members may read/write objects in the bucket.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS center_assets_read ON storage.objects;
CREATE POLICY center_assets_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'center-assets');

DROP POLICY IF EXISTS center_assets_write ON storage.objects;
CREATE POLICY center_assets_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'center-assets');

DROP POLICY IF EXISTS center_assets_update ON storage.objects;
CREATE POLICY center_assets_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'center-assets')
  WITH CHECK (bucket_id = 'center-assets');

-- ============================================================
-- VERIFY (run separately):
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('customers','invoices','employees') ;
--   -> relrowsecurity must be TRUE for all.
-- ============================================================

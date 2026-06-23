-- LenaBeauty Salon Management — Enable RLS and Add Policies
-- This migration ensures cross-center isolation by enforcing center_id checks.

-- 1. Ensure app_private schema and helpers exist
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO postgres, authenticated;
REVOKE ALL ON SCHEMA app_private FROM public, anon;

-- Define member roles if they don't exist
DO $$ BEGIN
    CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'auditor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role to center_memberships
ALTER TABLE public.center_memberships ADD COLUMN IF NOT EXISTS role public.member_role NOT NULL DEFAULT 'staff';

-- Helper to get current user's authorized center IDs
-- Returns empty array instead of NULL for safer policy checks
-- Uses profile_id to match the base schema's naming convention
CREATE OR REPLACE FUNCTION app_private.get_user_center_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(array_agg(center_id), ARRAY[]::UUID[])
  FROM public.center_memberships 
  WHERE profile_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Revoke public execution of the helper
REVOKE EXECUTE ON FUNCTION app_private.get_user_center_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.get_user_center_ids() TO authenticated, service_role;

-- Helper to check if user has specific roles in a center
CREATE OR REPLACE FUNCTION app_private.has_center_role(_center_id UUID, _roles public.member_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.center_memberships
    WHERE profile_id = auth.uid() 
      AND center_id = _center_id 
      AND is_active = true 
      AND role = ANY(_roles)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

REVOKE EXECUTE ON FUNCTION app_private.has_center_role(UUID, public.member_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_center_role(UUID, public.member_role[]) TO authenticated, service_role;

-- 2. Enable RLS on all operational tables
ALTER TABLE centers            ENABLE ROW LEVEL SECURITY;
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

-- 3. Define Policies

-- Centers: Users can only see centers they belong to
CREATE POLICY "Users view centers they belong to" 
ON public.centers FOR SELECT 
USING (id = ANY(app_private.get_user_center_ids()));

-- Memberships: Users can only see their own memberships
CREATE POLICY "Users view their own memberships" 
ON public.center_memberships FOR SELECT 
USING (profile_id = auth.uid());

-- Center Settings: Only managers+ can update
CREATE POLICY "Members view settings" 
ON public.center_settings FOR SELECT 
USING (center_id = ANY(app_private.get_user_center_ids()));

CREATE POLICY "Managers update settings" 
ON public.center_settings FOR UPDATE 
USING (app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role))
WITH CHECK (app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role));

-- Operational Tables with Cross-Table Integrity

-- Customers
CREATE POLICY "Center isolation for customers" ON public.customers
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Employees
CREATE POLICY "Center isolation for employees" ON public.employees
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Services
CREATE POLICY "Center isolation for services" ON public.services
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Products
CREATE POLICY "Center isolation for products" ON public.products
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Appointments: Must ensure referenced entities belong to the same center
CREATE POLICY "Center isolation for appointments" ON public.appointments
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (
    center_id = ANY(app_private.get_user_center_ids()) AND
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id AND center_id = appointments.center_id) AND
    (employee_id IS NULL OR EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND center_id = appointments.center_id)) AND
    (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services WHERE id = service_id AND center_id = appointments.center_id))
);

-- Expenses: Only managers+ can create/update/delete
CREATE POLICY "Members view expenses" ON public.expenses FOR SELECT
USING (center_id = ANY(app_private.get_user_center_ids()));

CREATE POLICY "Managers manage expenses" ON public.expenses
FOR ALL TO authenticated
USING (app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role))
WITH CHECK (app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role));

-- Invoices: Staff can create, but only managers+ can update/delete
CREATE POLICY "Members view invoices" ON public.invoices FOR SELECT
USING (center_id = ANY(app_private.get_user_center_ids()));

CREATE POLICY "Staff create invoices" ON public.invoices FOR INSERT
WITH CHECK (
    center_id = ANY(app_private.get_user_center_ids()) AND
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id AND center_id = invoices.center_id)
);

CREATE POLICY "Managers update invoices" ON public.invoices FOR UPDATE
USING (app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role))
WITH CHECK (
    app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role) AND
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id AND center_id = invoices.center_id)
);

CREATE POLICY "Managers delete invoices" ON public.invoices FOR DELETE
USING (app_private.has_center_role(center_id, ARRAY['owner', 'admin', 'manager']::public.member_role));

-- Invoice Items: Must reference services/products from the same center as the invoice
CREATE POLICY "Center isolation for invoice_items" ON public.invoice_items
FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.invoices WHERE id = invoice_id AND center_id = ANY(app_private.get_user_center_ids())
))
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id = invoice_id 
          AND i.center_id = ANY(app_private.get_user_center_ids())
          AND (service_id IS NULL OR EXISTS (SELECT 1 FROM public.services s WHERE s.id = service_id AND s.center_id = i.center_id))
          AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.center_id = i.center_id))
    )
);

-- 4. Storage RLS (center-assets bucket)
-- Note: Requires storage schema to be initialized
DO $$ BEGIN
    -- Ensure bucket is not public
    UPDATE storage.buckets SET public = false WHERE id = 'center-assets';

    -- Enable RLS on storage.objects if not already enabled
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

-- Storage Policies: Users can only access objects in a folder named after their center_id
DO $$ BEGIN
    CREATE POLICY "Center isolation for storage" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'center-assets' AND
        (storage.foldername(name))[1] = ANY(app_private.get_user_center_ids()::text[])
    )
    WITH CHECK (
        bucket_id = 'center-assets' AND
        (storage.foldername(name))[1] = ANY(app_private.get_user_center_ids()::text[])
    );
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_table THEN null;
END $$;

-- Allow admins/owners to manage memberships for their center
CREATE POLICY "Admins manage memberships" ON public.center_memberships
FOR ALL TO authenticated
USING (app_private.has_center_role(center_id, ARRAY['owner', 'admin']::public.member_role))
WITH CHECK (app_private.has_center_role(center_id, ARRAY['owner', 'admin']::public.member_role));

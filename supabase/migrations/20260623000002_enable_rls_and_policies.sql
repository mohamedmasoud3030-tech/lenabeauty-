-- LenaBeauty Salon Management — Enable RLS and Add Policies
-- This migration ensures cross-center isolation by enforcing center_id checks.

-- 1. Ensure app_private schema and helpers exist
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO postgres, authenticated;
REVOKE ALL ON SCHEMA app_private FROM public, anon;

-- Helper to get current user's authorized center IDs
CREATE OR REPLACE FUNCTION app_private.get_user_center_ids()
RETURNS UUID[] AS $$
  SELECT array_agg(center_id) 
  FROM public.center_memberships 
  WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

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
USING (user_id = auth.uid());

-- Center Settings: Authorized members can view and update
CREATE POLICY "Members view settings" 
ON public.center_settings FOR SELECT 
USING (center_id = ANY(app_private.get_user_center_ids()));

CREATE POLICY "Members update settings" 
ON public.center_settings FOR UPDATE 
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Operational Tables: Unified policy for customers, employees, services, products, appointments, expenses, invoices
-- We use a macro-like approach for consistency across these tables.

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

-- Appointments
CREATE POLICY "Center isolation for appointments" ON public.appointments
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Expenses
CREATE POLICY "Center isolation for expenses" ON public.expenses
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Invoices
CREATE POLICY "Center isolation for invoices" ON public.invoices
FOR ALL TO authenticated
USING (center_id = ANY(app_private.get_user_center_ids()))
WITH CHECK (center_id = ANY(app_private.get_user_center_ids()));

-- Invoice Items: Tied to invoices
CREATE POLICY "Center isolation for invoice_items" ON public.invoice_items
FOR ALL TO authenticated
USING (invoice_id IN (
    SELECT id FROM public.invoices WHERE center_id = ANY(app_private.get_user_center_ids())
))
WITH CHECK (invoice_id IN (
    SELECT id FROM public.invoices WHERE center_id = ANY(app_private.get_user_center_ids())
));

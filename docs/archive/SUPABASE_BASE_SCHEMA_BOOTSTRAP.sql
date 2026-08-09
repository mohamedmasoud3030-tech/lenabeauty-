-- SUPABASE BASE SCHEMA BOOTSTRAP (PHASE 10A)
-- This file defines the core tables securely.
-- IMPORTANT: Apply this before Phase 10B.
-- DO NOT APPLY CHECKOUT RPC OR INVOICE/PAYMENTS YET
-- DOES NOT ENABLE CHECKOUT (Safe base schema for live CRUD QA)

-- 1. Tenant & Identity Models
CREATE TABLE public.centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'auditor');

CREATE TABLE public.center_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.member_role NOT NULL DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(center_id, profile_id)
);

-- 2. Configuration Entity
CREATE TABLE public.center_settings (
    center_id UUID PRIMARY KEY REFERENCES public.centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    tax_rate NUMERIC(5, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'OMR',
    address TEXT,
    phone VARCHAR(50),
    cr VARCHAR(100),
    postal_code VARCHAR(20),
    logo_path TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Core Business Entities
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(100),
    salary NUMERIC(12, 3) DEFAULT 0.000,
    base_salary NUMERIC(12, 3) DEFAULT 0.000,
    commission_percentage NUMERIC(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 3) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(150),
    price NUMERIC(12, 3) NOT NULL,
    cost NUMERIC(12, 3) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(255),
    notes TEXT,
    total_spent NUMERIC(15, 3) DEFAULT 0.000,
    loyalty_points INTEGER DEFAULT 0,
    last_visit TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    date_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', 
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 3) NOT NULL,
    category VARCHAR(150) NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_customers_center_id ON public.customers(center_id);
CREATE INDEX idx_appointments_center_date ON public.appointments(center_id, date_time);

-- Row Level Security
ALTER TABLE public.centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.center_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.user_center_ids()
RETURNS UUID[] AS $$
  SELECT array_agg(center_id) 
  FROM public.center_memberships 
  WHERE profile_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

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

-- Configuration Protection
CREATE POLICY "Users view centers they belong to" 
ON public.centers FOR SELECT USING (id = ANY(app_private.user_center_ids()));

-- NOTE: In single-center MVP, admin can see all centers. For simplicity, we just use the user_center_ids constraint.
CREATE POLICY "Profiles are self-managed"
ON public.profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Users view memberships they belong to" 
ON public.center_memberships FOR SELECT USING (id IN (
    SELECT id FROM public.center_memberships WHERE profile_id = auth.uid()
));

CREATE POLICY "Users view settings for their centers" 
ON public.center_settings FOR SELECT USING (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Only managers and admins can edit settings" 
ON public.center_settings FOR UPDATE 
USING (app_private.has_center_role(center_id, ARRAY['owner'::public.member_role, 'admin'::public.member_role, 'manager'::public.member_role]));

-- Catalog Access
CREATE POLICY "Staff Universal Product Access" 
ON public.products FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Staff Universal Service Categories"
ON public.service_categories FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Staff Universal Service Access" 
ON public.services FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Staff Universal Employee Profile Access"
ON public.employees FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

-- CRM Boundaries
CREATE POLICY "Staff Universal Customer Control" 
ON public.customers FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

-- Operations
CREATE POLICY "Staff Universal Appointment Control" 
ON public.appointments FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

-- Expenses Access (we grant staff access for now to match frontend if we want smooth QA, 
-- or we can restrict it. Let's make it universal staff access for the MVP live CRUD QA to verify the forms)
CREATE POLICY "Staff Universal Expense Access" 
ON public.expenses FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));


-- =====================================================================
-- SEED / ADMIN SETUP (MANUAL INSTRUCTIONS)
-- =====================================================================
-- After this schema succeeds, apply docs/SUPABASE_STAGING_SEED_10A5.sql
-- in the same staging project. The seed script creates one center,
-- one admin profile, one active center_memberships row, one center_settings
-- row, and returns the generated VITE_CENTER_ID for .env.local.

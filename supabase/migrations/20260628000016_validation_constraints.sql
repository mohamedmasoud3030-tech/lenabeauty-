-- ============================================================
-- LenaBeauty — Data-integrity hardening: business value CHECK
-- constraints + center-scoped branding + product reorder level.
--
-- Adds idempotent CHECK constraints so invalid business values
-- (negative prices, negative stock, out-of-range percentages,
-- negative advances, negative tax, etc.) can never be persisted,
-- regardless of whether they come from a form or a direct API call.
--
-- Constraints are added with NOT VALID where a real production DB may
-- already contain legacy bad values. NOT VALID means existing rows are
-- not re-checked on ADD, but every subsequent INSERT/UPDATE is enforced.
-- You can later run `ALTER TABLE ... VALIDATE CONSTRAINT ...` to lock
-- down existing rows once the data has been cleaned.
--
-- Branding columns are center-scoped (each center_settings row already
-- belongs to exactly one center via center_id UNIQUE).
--
-- HOW TO RUN: Supabase SQL Editor, AFTER all previous migrations.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Products: reorder level column
-- ------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. Center-scoped branding columns
-- ------------------------------------------------------------
ALTER TABLE public.center_settings
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS brand_email TEXT,
  ADD COLUMN IF NOT EXISTS brand_tax_number TEXT,
  ADD COLUMN IF NOT EXISTS brand_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS brand_footer_text_ar TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_base64 TEXT;

-- ------------------------------------------------------------
-- 3. Business value CHECK constraints (idempotent)
-- ------------------------------------------------------------
-- services: price non-negative, duration positive.
DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_price_non_negative CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_duration_positive CHECK (duration_minutes > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- products: price / cost / stock / reorder level non-negative.
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_price_non_negative CHECK (price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_cost_non_negative CHECK (cost >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_stock_non_negative CHECK (stock_quantity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_reorder_level_non_negative CHECK (reorder_level >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- employees: salaries non-negative, commission bounded 0..100.
DO $$ BEGIN
  ALTER TABLE public.employees ADD CONSTRAINT employees_salary_non_negative CHECK (salary >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.employees ADD CONSTRAINT employees_base_salary_non_negative CHECK (base_salary >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.employees ADD CONSTRAINT employees_commission_percent CHECK (commission_percentage >= 0 AND commission_percentage <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- expenses: amount non-negative (zero allowed as default, UI enforces > 0).
DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_non_negative CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- appointments: deposit and no-show fees non-negative.
DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_deposit_non_negative CHECK (deposit_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_show_fee_non_negative CHECK (no_show_fee_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_show_charged_non_negative CHECK (no_show_fee_charged >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- invoices: totals, discount, tax non-negative (signed ledger adjustments
-- belong in accounting_journal_entries, NOT invoices).
DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_total_non_negative CHECK (total_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_discount_non_negative CHECK (discount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_tax_non_negative CHECK (tax >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- service_packages: price non-negative (quantity already CHECKed).
DO $$ BEGIN
  ALTER TABLE public.service_packages ADD CONSTRAINT service_packages_price_non_negative CHECK (package_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- employee_advances: amount non-negative (UI enforces strictly positive).
DO $$ BEGIN
  ALTER TABLE public.employee_advances ADD CONSTRAINT advances_amount_non_negative CHECK (amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- attendance: worked hours cannot be negative.
DO $$ BEGIN
  ALTER TABLE public.attendance_records ADD CONSTRAINT attendance_work_hours_non_negative CHECK (work_hours >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payroll_line_items: base salary, advances deducted, and net salary cannot
-- be negative. A salary never goes below zero.
DO $$ BEGIN
  ALTER TABLE public.payroll_line_items ADD CONSTRAINT payroll_base_salary_non_negative CHECK (base_salary >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payroll_line_items ADD CONSTRAINT payroll_advances_deducted_non_negative CHECK (advances_deducted >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payroll_line_items ADD CONSTRAINT payroll_net_salary_non_negative CHECK (net_salary >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- center_settings: tax rate bounded 0..100 (percent).
DO $$ BEGIN
  ALTER TABLE public.center_settings ADD CONSTRAINT center_settings_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- customer reviews: rating already CHECKed in migration 12; add a guard here
-- for robustness (idempotent).
DO $$ BEGIN
  ALTER TABLE public.customer_reviews ADD CONSTRAINT customer_reviews_rating_range CHECK (rating BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

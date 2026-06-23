-- ============================================================
-- LenaBeauty Salon Management — Initial Schema
-- Generated from full code audit: repositories.ts + mappers.ts
-- HOW TO RUN: Supabase Dashboard → SQL Editor → paste & run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. CENTERS
CREATE TABLE IF NOT EXISTS centers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CENTER_MEMBERSHIPS (getMyCenters: joins centers.name)
CREATE TABLE IF NOT EXISTS center_memberships (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES centers(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, center_id)
);

-- 3. CENTER_SETTINGS
CREATE TABLE IF NOT EXISTS center_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   UUID NOT NULL UNIQUE REFERENCES centers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Salon',
  currency    TEXT NOT NULL DEFAULT 'OMR',
  tax_rate    NUMERIC(5,2) NOT NULL DEFAULT 0,
  logo_path   TEXT,
  address     TEXT,
  phone       TEXT,
  cr          TEXT,
  postal_code TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  category       TEXT,
  phone          TEXT,
  email          TEXT,
  notes          TEXT,
  total_spent    NUMERIC(12,3) NOT NULL DEFAULT 0,
  loyalty_points INTEGER       NOT NULL DEFAULT 0,
  last_visit     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. EMPLOYEES  (month_commission_total: required by Dashboard PnL query)
CREATE TABLE IF NOT EXISTS employees (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id              UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  phone                  TEXT,
  role                   TEXT NOT NULL DEFAULT 'Staff',
  salary                 NUMERIC(12,3) NOT NULL DEFAULT 0,
  base_salary            NUMERIC(12,3) NOT NULL DEFAULT 0,
  commission_percentage  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  month_commission_total NUMERIC(12,3) NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SERVICES
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category_id      UUID,
  price            NUMERIC(12,3) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  barcode        TEXT,
  price          NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost           NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. APPOINTMENTS (status ENUM must match domain: SCHEDULED|COMPLETED|CANCELLED|NO_SHOW)
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   UUID NOT NULL REFERENCES centers(id)   ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  service_id  UUID REFERENCES services(id)  ON DELETE SET NULL,
  date_time   TIMESTAMPTZ NOT NULL,
  status      appointment_status NOT NULL DEFAULT 'SCHEDULED',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  amount      NUMERIC(12,3) NOT NULL DEFAULT 0,
  category    TEXT NOT NULL,
  description TEXT,
  date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id           UUID NOT NULL REFERENCES centers(id)   ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
  serial_number       TEXT,
  date                TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_amount        NUMERIC(12,3) NOT NULL DEFAULT 0,
  discount            NUMERIC(12,3) NOT NULL DEFAULT 0,
  loyalty_points_used INTEGER NOT NULL DEFAULT 0,
  payment_method      TEXT NOT NULL DEFAULT 'CASH',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. INVOICE_ITEMS (joined to services+products for name lookups)
CREATE TABLE IF NOT EXISTS invoice_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id)  ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  price      NUMERIC(12,3) NOT NULL DEFAULT 0,
  quantity   INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. STORAGE BUCKET (Settings.uploadLogo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('center-assets', 'center-assets', false)
ON CONFLICT (id) DO NOTHING;

-- 13. INDEXES
CREATE INDEX IF NOT EXISTS idx_customers_center    ON customers(center_id);
CREATE INDEX IF NOT EXISTS idx_employees_center    ON employees(center_id);
CREATE INDEX IF NOT EXISTS idx_services_center     ON services(center_id);
CREATE INDEX IF NOT EXISTS idx_products_center     ON products(center_id);
CREATE INDEX IF NOT EXISTS idx_products_stock      ON products(center_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_appointments_center ON appointments(center_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dt     ON appointments(center_id, date_time);
CREATE INDEX IF NOT EXISTS idx_expenses_center     ON expenses(center_id, date);
CREATE INDEX IF NOT EXISTS idx_invoices_date       ON invoices(center_id, date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv   ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user    ON center_memberships(user_id);

-- 14. AUTO updated_at TRIGGER
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON centers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON center_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 15. SEED: Center row (must match VITE_CENTER_ID)
INSERT INTO centers (id, name)
VALUES ('7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d', 'LenaBeauty')
ON CONFLICT (id) DO NOTHING;

INSERT INTO center_settings (center_id, name, currency)
VALUES ('7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d', 'LenaBeauty', 'OMR')
ON CONFLICT (center_id) DO NOTHING;

-- 16. RLS — DISABLE FOR DEVELOPMENT (re-enable + add policies before production)
ALTER TABLE centers            DISABLE ROW LEVEL SECURITY;
ALTER TABLE center_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE center_settings    DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers          DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees          DISABLE ROW LEVEL SECURITY;
ALTER TABLE services           DISABLE ROW LEVEL SECURITY;
ALTER TABLE products           DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments       DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items      DISABLE ROW LEVEL SECURITY;

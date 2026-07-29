-- DRAFT ONLY - DO NOT EXECUTE
-- Supabase Schema Draft: Business Tables & Tenant Layout
-- Architecture: Explicit Multi-Tenant with center_id columns.

-- 1. Tenant & Identity Models
CREATE TABLE centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Extended profile bound to GoTrue auth.users
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Defines permission hierarchy
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'auditor');

-- Assigns a profile to a tenant workspace
CREATE TABLE center_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(center_id, profile_id)
);

-- 2. Configuration Entity
CREATE TABLE center_settings (
    center_id UUID PRIMARY KEY REFERENCES centers(id) ON DELETE CASCADE,
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
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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

CREATE TABLE service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 3) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    barcode VARCHAR(150),
    price NUMERIC(12, 3) NOT NULL,
    cost NUMERIC(12, 3) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN ('checkout', 'manual_adjustment', 'restock', 'correction')),
    quantity_delta INTEGER NOT NULL,
    reason TEXT,
    invoice_id UUID, -- NULL if not related to an invoice
    created_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
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

-- 4. Transactions & Operational Workflows
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    date_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', 
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    serial_number SERIAL,
    date TIMESTAMPTZ DEFAULT now(),
    total_amount NUMERIC(15, 3) NOT NULL,
    discount NUMERIC(12, 3) DEFAULT 0.000,
    loyalty_points_used INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'FINALIZED' CHECK (status IN ('DRAFT', 'FINALIZED', 'VOIDED')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    price NUMERIC(12, 3) NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount NUMERIC(15, 3) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference VARCHAR(255),
    created_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 3) NOT NULL,
    category VARCHAR(150) NOT NULL,
    description TEXT,
    date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- General High-cardinality indexes
CREATE INDEX idx_customers_center_id ON customers(center_id);
CREATE INDEX idx_appointments_center_date ON appointments(center_id, date_time);
CREATE INDEX idx_invoices_center_date ON invoices(center_id, date);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

-- 5. Row Level Security (RLS) Policies
-- These policies enforce that a user can only read, insert, update, or delete rows
-- for centers they are actively a member of.

-- Enable RLS on core tables
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_memberships ENABLE ROW LEVEL SECURITY;

-- Helper Function (Optional but recommended for performance in RLS)
-- Checks if the auth.uid() has an active membership for a given center_id
-- We use a basic exists check directly in the policy for simplicity here.

-- Policies for center_memberships (Users can read their own memberships)
CREATE POLICY "Users can view their own memberships" ON center_memberships
    FOR SELECT USING (profile_id = auth.uid());

-- Policies for appointments
CREATE POLICY "Users can view appointments of their centers" ON appointments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = appointments.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can insert appointments for their centers" ON appointments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = appointments.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can update appointments of their centers" ON appointments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = appointments.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can delete appointments of their centers" ON appointments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = appointments.center_id AND is_active = true
        )
    );

-- Policies for products
CREATE POLICY "Users can view products of their centers" ON products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = products.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can insert products for their centers" ON products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = products.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can update products of their centers" ON products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = products.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can delete products of their centers" ON products
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = products.center_id AND is_active = true
        )
    );

-- Policies for expenses
CREATE POLICY "Users can view expenses of their centers" ON expenses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = expenses.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can insert expenses for their centers" ON expenses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = expenses.center_id AND is_active = true
        )
    );

CREATE POLICY "Users can delete expenses of their centers" ON expenses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM center_memberships 
            WHERE profile_id = auth.uid() AND center_id = expenses.center_id AND is_active = true
        )
    );

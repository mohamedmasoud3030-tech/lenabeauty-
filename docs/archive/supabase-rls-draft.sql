-- DRAFT ONLY - DO NOT EXECUTE
-- Row Level Security (RLS) Policies Draft

ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE center_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS app_private;

-- Utility Function: Fetch user's active tenant associations
CREATE OR REPLACE FUNCTION app_private.user_center_ids()
RETURNS UUID[] AS $$
  SELECT array_agg(center_id) 
  FROM public.center_memberships 
  WHERE profile_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth;

-- Utility Function: Role verification bounding
CREATE OR REPLACE FUNCTION app_private.has_center_role(_center_id UUID, _roles member_role[])
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
ON centers FOR SELECT USING (id = ANY(app_private.user_center_ids()));

CREATE POLICY "Users view settings for their centers" 
ON center_settings FOR SELECT USING (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Only managers and admins can edit settings" 
ON center_settings FOR UPDATE 
USING (app_private.has_center_role(center_id, ARRAY['owner'::member_role, 'admin'::member_role, 'manager'::member_role]));

-- Catalog Access (Universal Staff Read/Write for simplicity, unless tightly managed)
CREATE POLICY "Staff Universal Product Access" 
ON products FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Staff Universal Service Access" 
ON services FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

CREATE POLICY "Staff Universal Employee Profile Access"
ON employees FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

-- CRM Boundaries
CREATE POLICY "Staff Universal Customer Control" 
ON customers FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

-- Operations
CREATE POLICY "Staff Universal Appointment Control" 
ON appointments FOR ALL USING (center_id = ANY(app_private.user_center_ids())) WITH CHECK (center_id = ANY(app_private.user_center_ids()));

-- Financial Integrity (Invoices & Expenses)
-- Protect strict writes. Direct mutations into Invoices should be rejected in favor of the RPC.
-- Threat mitigation: Client-side manipulation of ledger records.
CREATE POLICY "Allow Staff Read Invoices" ON invoices FOR SELECT USING (center_id = ANY(app_private.user_center_ids()));
CREATE POLICY "Forbid raw invoice inserts" ON invoices FOR INSERT WITH CHECK (false); 
CREATE POLICY "Forbid raw invoice updates" ON invoices FOR UPDATE USING (false) WITH CHECK (false); 
CREATE POLICY "Forbid raw invoice deletes" ON invoices FOR DELETE USING (false); 

CREATE POLICY "Allow Staff Read Invoice Items" ON invoice_items FOR SELECT USING (center_id = ANY(app_private.user_center_ids()));
CREATE POLICY "Forbid raw invoice_item inserts" ON invoice_items FOR INSERT WITH CHECK (false);
CREATE POLICY "Forbid raw invoice_item updates" ON invoice_items FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Forbid raw invoice_item deletes" ON invoice_items FOR DELETE USING (false);

CREATE POLICY "Allow Staff Read Payments" ON payments FOR SELECT USING (center_id = ANY(app_private.user_center_ids()));
CREATE POLICY "Forbid raw payment inserts" ON payments FOR INSERT WITH CHECK (false);
CREATE POLICY "Forbid raw payment updates" ON payments FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Forbid raw payment deletes" ON payments FOR DELETE USING (false);

CREATE POLICY "Allow Staff Read Inventory Movements" ON inventory_movements FOR SELECT USING (center_id = ANY(app_private.user_center_ids()));
CREATE POLICY "Forbid raw inventory_movements inserts" ON inventory_movements FOR INSERT WITH CHECK (false);
CREATE POLICY "Forbid raw inventory_movements updates" ON inventory_movements FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "Forbid raw inventory_movements deletes" ON inventory_movements FOR DELETE USING (false);

-- Note: The FOR INSERT/UPDATE/DELETE WITH CHECK(false) policies specifically block client-level mutations, while allowing RPCs running as SECURITY DEFINER to bypass RLS.

-- Expense Isolation
CREATE POLICY "Admins read expenses" 
ON expenses FOR SELECT 
USING (app_private.has_center_role(center_id, ARRAY['owner'::member_role, 'admin'::member_role, 'manager'::member_role]));

CREATE POLICY "Admins manage expenses" 
ON expenses FOR ALL 
USING (app_private.has_center_role(center_id, ARRAY['owner'::member_role, 'admin'::member_role, 'manager'::member_role]))
WITH CHECK (app_private.has_center_role(center_id, ARRAY['owner'::member_role, 'admin'::member_role, 'manager'::member_role]));

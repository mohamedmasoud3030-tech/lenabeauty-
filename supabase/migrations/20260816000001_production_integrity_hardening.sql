-- =============================================================================
-- LenaBeauty — production authorization and referential-integrity hardening
-- =============================================================================
-- Additive security migration. No business rows are deleted or rewritten.
-- Existing membership roles are copied from the canonical Auth metadata used by
-- the shipped application; all unknown/missing roles fail closed to STAFF.
-- =============================================================================

BEGIN;

-- Roles must be server-governed and center-scoped. A membership column cannot be
-- edited through the client because center_memberships has SELECT-only RLS.
ALTER TABLE public.center_memberships
  ADD COLUMN IF NOT EXISTS role TEXT;

DO $role_backfill$
BEGIN
  -- Managed Supabase exposes both metadata columns. The replay harness uses a
  -- deliberately minimal auth.users surrogate, so keep the catalog-dependent
  -- expression in dynamic SQL and fall back to STAFF when those columns are
  -- unavailable.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users'
      AND column_name = 'raw_app_meta_data'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users'
      AND column_name = 'raw_user_meta_data'
  ) THEN
    -- Freeze the previously canonical user_metadata role into server-owned
    -- app_metadata before the frontend starts trusting app_metadata only.
    EXECUTE $promote_role$
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', upper(raw_user_meta_data->>'role'))
      WHERE upper(COALESCE(raw_app_meta_data->>'role', '')) NOT IN ('ADMIN', 'MANAGER', 'STAFF')
        AND upper(COALESCE(raw_user_meta_data->>'role', '')) IN ('ADMIN', 'MANAGER', 'STAFF')
    $promote_role$;

    EXECUTE $backfill$
      UPDATE public.center_memberships AS membership
      SET role = CASE
        WHEN upper(COALESCE(auth_user.raw_app_meta_data->>'role', auth_user.raw_user_meta_data->>'role', ''))
             IN ('ADMIN', 'MANAGER', 'STAFF')
          THEN upper(COALESCE(auth_user.raw_app_meta_data->>'role', auth_user.raw_user_meta_data->>'role'))
        ELSE 'STAFF'
      END
      FROM auth.users AS auth_user
      WHERE auth_user.id = membership.profile_id
        AND membership.role IS NULL
    $backfill$;
  END IF;
END
$role_backfill$;

UPDATE public.center_memberships SET role = 'STAFF' WHERE role IS NULL;
ALTER TABLE public.center_memberships ALTER COLUMN role SET DEFAULT 'STAFF';
ALTER TABLE public.center_memberships ALTER COLUMN role SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.center_memberships
    ADD CONSTRAINT center_memberships_role_valid
    CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION app_private.has_center_role(
  _center_id UUID,
  _allowed_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.center_memberships AS membership
    WHERE membership.profile_id = auth.uid()
      AND membership.center_id = _center_id
      AND membership.role = ANY (_allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION app_private.has_center_role(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_center_role(UUID, TEXT[]) TO authenticated;

-- The shipped routes expose attendance, advances, payroll and staff analytics
-- only behind RequireAdmin. Enforce that same boundary at the database, where a
-- crafted REST request cannot bypass it.
DROP POLICY IF EXISTS attendance_tenant ON public.attendance_records;
DROP POLICY IF EXISTS advances_tenant ON public.employee_advances;
DROP POLICY IF EXISTS payroll_runs_tenant ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_lines_tenant ON public.payroll_line_items;

DROP POLICY IF EXISTS attendance_admin ON public.attendance_records;
CREATE POLICY attendance_admin ON public.attendance_records
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS advances_admin ON public.employee_advances;
CREATE POLICY advances_admin ON public.employee_advances
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS payroll_runs_admin ON public.payroll_runs;
CREATE POLICY payroll_runs_admin ON public.payroll_runs
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS payroll_lines_admin ON public.payroll_line_items;
CREATE POLICY payroll_lines_admin ON public.payroll_line_items
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

-- Tenant-scoped foreign keys prevent same-table RLS from being bypassed by
-- attaching a row in one center to a parent in another center.
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_id_center_unique
  ON public.employees(id, center_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_runs_id_center_unique
  ON public.payroll_runs(id, center_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_categories_id_center_unique
  ON public.service_categories(id, center_id);

DO $$ BEGIN
  ALTER TABLE public.attendance_records
    ADD CONSTRAINT attendance_employee_center_fk
    FOREIGN KEY (employee_id, center_id)
    REFERENCES public.employees(id, center_id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.employee_advances
    ADD CONSTRAINT advances_employee_center_fk
    FOREIGN KEY (employee_id, center_id)
    REFERENCES public.employees(id, center_id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION app_private.enforce_advance_payroll_center_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, app_private
AS $$
BEGIN
  IF NEW.deducted_in_run_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.payroll_runs AS run
    WHERE run.id = NEW.deducted_in_run_id AND run.center_id = NEW.center_id
  ) THEN
    RAISE EXCEPTION 'advance_payroll_run_center_mismatch' USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_advance_payroll_center_v1 ON public.employee_advances;
CREATE TRIGGER enforce_advance_payroll_center_v1
  BEFORE INSERT OR UPDATE OF deducted_in_run_id, center_id ON public.employee_advances
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_advance_payroll_center_v1();

REVOKE ALL ON FUNCTION app_private.enforce_advance_payroll_center_v1() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  ALTER TABLE public.payroll_line_items
    ADD CONSTRAINT payroll_lines_run_center_fk
    FOREIGN KEY (payroll_run_id, center_id)
    REFERENCES public.payroll_runs(id, center_id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payroll_line_items
    ADD CONSTRAINT payroll_lines_employee_center_fk
    FOREIGN KEY (employee_id, center_id)
    REFERENCES public.employees(id, center_id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.services
    ADD CONSTRAINT services_category_center_fk
    FOREIGN KEY (category_id, center_id)
    REFERENCES public.service_categories(id, center_id) ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Validation is intentionally non-destructive: deployment stops if pre-existing
-- corruption is found instead of silently preserving an unsafe relationship.
ALTER TABLE public.attendance_records VALIDATE CONSTRAINT attendance_employee_center_fk;
ALTER TABLE public.employee_advances VALIDATE CONSTRAINT advances_employee_center_fk;
ALTER TABLE public.payroll_line_items VALIDATE CONSTRAINT payroll_lines_run_center_fk;
ALTER TABLE public.payroll_line_items VALIDATE CONSTRAINT payroll_lines_employee_center_fk;
ALTER TABLE public.services VALIDATE CONSTRAINT services_category_fk;
ALTER TABLE public.services VALIDATE CONSTRAINT services_category_center_fk;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_invoice_center_fk;

-- Keep one unambiguous PostgREST relationship per parent while preserving each
-- original ON DELETE behavior through the equivalent composite constraint.
ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_employee_id_fkey;
ALTER TABLE public.employee_advances
  DROP CONSTRAINT IF EXISTS employee_advances_employee_id_fkey;
ALTER TABLE public.payroll_line_items
  DROP CONSTRAINT IF EXISTS payroll_line_items_payroll_run_id_fkey,
  DROP CONSTRAINT IF EXISTS payroll_line_items_employee_id_fkey;
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_category_fk;
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;

-- Trigger-only internal routines: no client role needs direct EXECUTE.
REVOKE ALL ON FUNCTION app_private.maintain_entitlement_balance_v1() FROM PUBLIC, anon, authenticated;

COMMIT;

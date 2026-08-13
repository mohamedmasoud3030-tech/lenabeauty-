-- =============================================================================
-- LenaBeauty — Role-aware RLS: staff operations (P0 security)
-- -----------------------------------------------------------------------------
-- Problem: attendance_records / employee_advances / payroll_runs /
-- payroll_line_items all shipped a `FOR ALL` policy gated only by
-- `app_private.is_center_member`, so ANY center member could insert, update
-- or delete financial rows. RequireAdmin in the UI alone did not protect the
-- database.
--
-- This migration:
--   1. Adds role helpers that read the authoritative role from
--      auth.users.raw_user_meta_data (the same source mapAuthSession uses:
--      ADMIN / MANAGER / STAFF).
--   2. Replaces the FOR ALL member policies with:
--        * SELECT — every center member (read-only)
--        * INSERT/UPDATE/DELETE — ADMIN and MANAGER only
-- -----------------------------------------------------------------------------
-- Idempotent. Run AFTER 20260811004300_refund_status_repair.sql.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Role helpers (authoritative, SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT COALESCE(u.raw_user_meta_data ->> 'role', 'STAFF')
  FROM auth.users u
  WHERE u.id = auth.uid();
$$;

-- `has_center_role(center_id, 'ADMIN', 'MANAGER')` — true when the caller is a
-- member of the center AND their stored app role is one of the allowed roles.
CREATE OR REPLACE FUNCTION app_private.has_center_role(_center_id UUID, VARIADIC _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.center_memberships cm
    WHERE cm.center_id = _center_id
      AND cm.profile_id = auth.uid()
      AND COALESCE(
            (SELECT u.raw_user_meta_data ->> 'role'
             FROM auth.users u
             WHERE u.id = cm.profile_id),
            'STAFF'
          ) = ANY (_roles)
  );
$$;

-- Policy expressions run under the querying role, so the helpers must be
-- executable by authenticated (and anon, mirroring is_center_member; anon has
-- no memberships so it always evaluates to false).
GRANT EXECUTE ON FUNCTION app_private.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_center_role(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.user_role() TO anon;
GRANT EXECUTE ON FUNCTION app_private.has_center_role(UUID, TEXT[]) TO anon;

-- -----------------------------------------------------------------------------
-- 2. attendance_records: members read, ADMIN/MANAGER write
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_tenant ON public.attendance_records;
DROP POLICY IF EXISTS attendance_member_select ON public.attendance_records;
DROP POLICY IF EXISTS attendance_manager_write ON public.attendance_records;

CREATE POLICY attendance_member_select ON public.attendance_records
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

CREATE POLICY attendance_manager_write ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY attendance_manager_update ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY attendance_manager_delete ON public.attendance_records
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

-- -----------------------------------------------------------------------------
-- 3. employee_advances: members read, ADMIN/MANAGER write
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS advances_tenant ON public.employee_advances;
DROP POLICY IF EXISTS advances_member_select ON public.employee_advances;
DROP POLICY IF EXISTS advances_manager_write ON public.employee_advances;

CREATE POLICY advances_member_select ON public.employee_advances
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

CREATE POLICY advances_manager_insert ON public.employee_advances
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY advances_manager_update ON public.employee_advances
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY advances_manager_delete ON public.employee_advances
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

-- -----------------------------------------------------------------------------
-- 4. payroll_runs: members read, ADMIN/MANAGER write
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_runs_tenant ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_member_select ON public.payroll_runs;
DROP POLICY IF EXISTS payroll_runs_manager_write ON public.payroll_runs;

CREATE POLICY payroll_runs_member_select ON public.payroll_runs
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

CREATE POLICY payroll_runs_manager_insert ON public.payroll_runs
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY payroll_runs_manager_update ON public.payroll_runs
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY payroll_runs_manager_delete ON public.payroll_runs
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

-- -----------------------------------------------------------------------------
-- 5. payroll_line_items: members read, ADMIN/MANAGER write
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS payroll_lines_tenant ON public.payroll_line_items;
DROP POLICY IF EXISTS payroll_lines_member_select ON public.payroll_line_items;
DROP POLICY IF EXISTS payroll_lines_manager_write ON public.payroll_line_items;

CREATE POLICY payroll_lines_member_select ON public.payroll_line_items
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

CREATE POLICY payroll_lines_manager_insert ON public.payroll_line_items
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY payroll_lines_manager_update ON public.payroll_line_items
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE POLICY payroll_lines_manager_delete ON public.payroll_line_items
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

COMMIT;

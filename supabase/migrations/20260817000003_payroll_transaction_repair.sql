-- =============================================================================
-- LenaBeauty — transactional payroll run boundary
-- =============================================================================
-- Replaces the browser-side run -> lines -> advances sequence with one ADMIN-
-- governed PostgreSQL transaction. The existing Phase-1 compensation formula
-- is preserved exactly: net = max(base salary - approved monthly advances, 0).
-- Commission calculation is intentionally not invented by this migration.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_payroll_run_v1(
  p_center_id UUID,
  p_period_month TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_run public.payroll_runs;
  v_lines JSONB;
  v_year INTEGER;
  v_month INTEGER;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_period_month IS NULL OR p_period_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_payroll_period' USING ERRCODE = '22023';
  END IF;

  v_year := split_part(p_period_month, '-', 1)::INTEGER;
  v_month := split_part(p_period_month, '-', 2)::INTEGER;
  v_month_start := make_timestamptz(v_year, v_month, 1, 0, 0, 0, 'UTC');
  v_month_end := v_month_start + INTERVAL '1 month';

  INSERT INTO public.payroll_runs (center_id, period_month, notes)
  VALUES (p_center_id, p_period_month, NULLIF(btrim(COALESCE(p_notes, '')), ''))
  RETURNING * INTO v_run;

  WITH approved_advances AS (
    SELECT employee_id, round(COALESCE(sum(amount), 0), 3) AS amount
    FROM public.employee_advances
    WHERE center_id = p_center_id
      AND status = 'APPROVED'
      AND advance_date >= v_month_start
      AND advance_date < v_month_end
    GROUP BY employee_id
  ), inserted AS (
    INSERT INTO public.payroll_line_items (
      center_id, payroll_run_id, employee_id,
      base_salary, advances_deducted, net_salary
    )
    SELECT
      p_center_id,
      v_run.id,
      employee.id,
      round(COALESCE(employee.base_salary, employee.salary, 0), 3),
      round(COALESCE(advance.amount, 0), 3),
      round(greatest(
        COALESCE(employee.base_salary, employee.salary, 0) - COALESCE(advance.amount, 0),
        0
      ), 3)
    FROM public.employees employee
    LEFT JOIN approved_advances advance ON advance.employee_id = employee.id
    WHERE employee.center_id = p_center_id AND employee.is_active = TRUE
    ORDER BY employee.name
    RETURNING *
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(inserted) ORDER BY inserted.created_at, inserted.id), '[]'::jsonb)
  INTO v_lines
  FROM inserted;

  UPDATE public.employee_advances
  SET status = 'DEDUCTED', deducted_in_run_id = v_run.id
  WHERE center_id = p_center_id
    AND status = 'APPROVED'
    AND advance_date >= v_month_start
    AND advance_date < v_month_end;

  RETURN jsonb_build_object('run', to_jsonb(v_run), 'lines', v_lines);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'payroll_period_already_exists' USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_payroll_run_v1(
  p_center_id UUID,
  p_payroll_run_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_run_id UUID;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_run_id
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id AND center_id = p_center_id
  FOR UPDATE;
  IF v_run_id IS NULL THEN
    RAISE EXCEPTION 'payroll_run_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.employee_advances
  SET status = 'APPROVED', deducted_in_run_id = NULL
  WHERE center_id = p_center_id AND deducted_in_run_id = v_run_id;

  DELETE FROM public.payroll_runs
  WHERE id = v_run_id AND center_id = p_center_id;

  RETURN jsonb_build_object('deleted_payroll_run_id', v_run_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_payroll_run_v1(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_payroll_run_v1(UUID, UUID) TO authenticated;

-- Prevent direct PostgREST mutations from bypassing the transaction above.
-- Reads remain available to ADMIN through RLS; all writes run as the function
-- owner inside create/delete_payroll_run_v1.
REVOKE INSERT, UPDATE, DELETE ON public.payroll_runs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payroll_line_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payroll_runs, public.payroll_line_items TO authenticated;

COMMIT;

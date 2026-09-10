-- =============================================================================
-- LenaBeauty — Commission engine (completes the dead commission surface).
--
-- Before this migration: employees.commission_percentage was stored but never
-- used, employees.month_commission_total was never updated (always 0), the PnL
-- "commissions" row summed that dead column, and payroll runs paid only
-- base − advances. Nothing in the product ever computed a commission.
--
-- After this migration commissions are DERIVED FROM STORED FACTS ONLY:
--   earned revenue per PAID invoice  =  total_amount − tax − prepaid sold on
--   the invoice + prepaid redeemed on the invoice  (identical to the PnL
--   revenue definition in get_dashboard_pnl_v1, so payroll and the dashboard
--   can never disagree), attributed to the invoice's employee_id.
--   commission(employee, period)     =  round(Σ earned × commission_pct/100).
--   payroll net                      =  greatest(base + commission − advances, 0).
--
-- Additive policy: employees.month_commission_total is left in place (legacy,
-- no longer read); payroll_line_items gains a commission_amount snapshot so a
-- historical run stays immutable even if percentages change later.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Payroll line items: store the commission snapshot per employee per run.
-- -----------------------------------------------------------------------------
ALTER TABLE public.payroll_line_items
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,3) NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.payroll_line_items
    ADD CONSTRAINT payroll_line_commission_non_negative
    CHECK (commission_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 2. create_payroll_run_v1 — now pays base + commission − advances.
--    Signature is UNCHANGED so existing grants keep applying.
-- -----------------------------------------------------------------------------
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
  IF p_period_month IS NULL OR p_period_month !~ '^[0-9]{4}-(0[0-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_payroll_period' USING ERRCODE = '22023';
  END IF;

  v_year := split_part(p_period_month, '-', 1)::INTEGER;
  v_month := split_part(p_period_month, '-', 2)::INTEGER;
  v_month_start := make_timestamptz(v_year, v_month, 1, 0, 0, 0, 'UTC');
  v_month_end := v_month_start + INTERVAL '1 month';

  INSERT INTO public.payroll_runs (center_id, period_month, notes)
  VALUES (p_center_id, p_period_month, NULLIF(btrim(COALESCE(p_notes, '')), ''))
  RETURNING * INTO v_run;

  WITH
  -- Prepaid instruments (packages / gift cards) sold on an invoice in the
  -- period: their sale value is deferred revenue, not earned revenue.
  prepaid AS (
    SELECT ii.invoice_id,
           round(COALESCE(sum(ii.price * ii.quantity), 0), 3) AS amount
    FROM public.invoice_items ii
    JOIN public.invoices inv ON inv.id = ii.invoice_id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= v_month_start AND inv.date < v_month_end
      AND (ii.package_id IS NOT NULL OR ii.gift_card_id IS NOT NULL)
    GROUP BY ii.invoice_id
  ),
  -- Prepaid instruments redeemed on an invoice: redemption is the moment the
  -- revenue is actually earned by the delivering employee.
  redeemed AS (
    SELECT el.invoice_id, round(COALESCE(sum(el.amount), 0), 3) AS amount
    FROM public.entitlement_ledger el
    WHERE el.center_id = p_center_id
      AND el.entry_type = 'REDEEM'
      AND el.invoice_id IS NOT NULL
    GROUP BY el.invoice_id
  ),
  -- Earned revenue per invoice, attributed to the checkout employee.
  earned_per_invoice AS (
    SELECT inv.employee_id,
           sum(greatest(
             inv.total_amount
             - COALESCE(inv.tax, 0)
             - COALESCE(prepaid.amount, 0)
             + COALESCE(redeemed.amount, inv.gift_card_discount, 0),
             0
           )) AS earned
    FROM public.invoices inv
    LEFT JOIN prepaid ON prepaid.invoice_id = inv.id
    LEFT JOIN redeemed ON redeemed.invoice_id = inv.id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= v_month_start AND inv.date < v_month_end
      AND inv.employee_id IS NOT NULL
    GROUP BY inv.employee_id
  ),
  approved_advances AS (
    SELECT employee_id, round(COALESCE(sum(amount), 0), 3) AS amount
    FROM public.employee_advances
    WHERE center_id = p_center_id
      AND status = 'APPROVED'
      AND advance_date >= v_month_start
      AND advance_date < v_month_end
    GROUP BY employee_id
  ),
  inserted AS (
    INSERT INTO public.payroll_line_items (
      center_id, payroll_run_id, employee_id,
      base_salary, commission_amount, advances_deducted, net_salary
    )
    SELECT
      p_center_id,
      v_run.id,
      employee.id,
      round(COALESCE(employee.base_salary, employee.salary, 0), 3),
      round(
        COALESCE(employee.commission_percentage, 0) / 100.0
        * COALESCE(earned.earned, 0),
        3
      ),
      round(COALESCE(advance.amount, 0), 3),
      round(greatest(
        COALESCE(employee.base_salary, employee.salary, 0)
        + round(
            COALESCE(employee.commission_percentage, 0) / 100.0
            * COALESCE(earned.earned, 0),
            3
          )
        - COALESCE(advance.amount, 0),
        0
      ), 3)
    FROM public.employees employee
    LEFT JOIN earned_per_invoice earned ON earned.employee_id = employee.id
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

-- -----------------------------------------------------------------------------
-- 3. get_dashboard_pnl_v1 — "commissions" becomes a real derived number for
--    the requested period (invoices × percentages), replacing the dead
--    legacy snapshot-column sum. Signature is UNCHANGED.
--    Note: v_from/v_to are month-agnostic; the PnL period commission uses the
--    same earned-revenue definition as the payroll run so the two agree for
--    overlapping ranges.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_pnl_v1(
  p_center_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_revenue NUMERIC(14,3) := 0;
  v_expenses NUMERIC(14,3) := 0;
  v_base_salaries NUMERIC(14,3) := 0;
  v_commissions NUMERIC(14,3) := 0;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN
    RAISE EXCEPTION 'invalid_dashboard_range' USING ERRCODE = '22023';
  END IF;

  WITH prepaid AS (
    SELECT ii.invoice_id,
           round(COALESCE(sum(ii.price * ii.quantity), 0), 3) AS amount
    FROM public.invoice_items ii
    JOIN public.invoices inv ON inv.id = ii.invoice_id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= p_from AND inv.date < p_to
      AND (ii.package_id IS NOT NULL OR ii.gift_card_id IS NOT NULL)
    GROUP BY ii.invoice_id
  ), redeemed AS (
    SELECT el.invoice_id, round(COALESCE(sum(el.amount), 0), 3) AS amount
    FROM public.entitlement_ledger el
    WHERE el.center_id = p_center_id
      AND el.entry_type = 'REDEEM'
      AND el.invoice_id IS NOT NULL
    GROUP BY el.invoice_id
  )
  SELECT round(COALESCE(sum(greatest(
    inv.total_amount
    - COALESCE(inv.tax, 0)
    - COALESCE(prepaid.amount, 0)
    + COALESCE(redeemed.amount, inv.gift_card_discount, 0),
    0
  )), 0), 3)
  INTO v_revenue
  FROM public.invoices inv
  LEFT JOIN prepaid ON prepaid.invoice_id = inv.id
  LEFT JOIN redeemed ON redeemed.invoice_id = inv.id
  WHERE inv.center_id = p_center_id
    AND inv.status = 'PAID'
    AND inv.date >= p_from AND inv.date < p_to;

  SELECT round(COALESCE(sum(amount), 0), 3)
  INTO v_expenses
  FROM public.expenses
  WHERE center_id = p_center_id AND date >= p_from AND date < p_to;

  SELECT
    round(COALESCE(sum(COALESCE(base_salary, salary, 0)), 0), 3)
  INTO v_base_salaries
  FROM public.employees
  WHERE center_id = p_center_id AND is_active = TRUE;

  -- Period commissions: earned revenue per employee in the SAME window times
  -- each employee's current percentage. Derived from invoices, never from the
  -- legacy per-employee snapshot column.
  WITH prepaid AS (
    SELECT ii.invoice_id,
           round(COALESCE(sum(ii.price * ii.quantity), 0), 3) AS amount
    FROM public.invoice_items ii
    JOIN public.invoices inv ON inv.id = ii.invoice_id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= p_from AND inv.date < p_to
      AND (ii.package_id IS NOT NULL OR ii.gift_card_id IS NOT NULL)
    GROUP BY ii.invoice_id
  ), redeemed AS (
    SELECT el.invoice_id, round(COALESCE(sum(el.amount), 0), 3) AS amount
    FROM public.entitlement_ledger el
    WHERE el.center_id = p_center_id
      AND el.entry_type = 'REDEEM'
      AND el.invoice_id IS NOT NULL
    GROUP BY el.invoice_id
  ), earned_per_invoice AS (
    SELECT inv.employee_id,
           sum(greatest(
             inv.total_amount
             - COALESCE(inv.tax, 0)
             - COALESCE(prepaid.amount, 0)
             + COALESCE(redeemed.amount, inv.gift_card_discount, 0),
             0
           )) AS earned
    FROM public.invoices inv
    LEFT JOIN prepaid ON prepaid.invoice_id = inv.id
    LEFT JOIN redeemed ON redeemed.invoice_id = inv.id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= p_from AND inv.date < p_to
      AND inv.employee_id IS NOT NULL
    GROUP BY inv.employee_id
  )
  SELECT round(COALESCE(sum(
    COALESCE(e.commission_percentage, 0) / 100.0 * COALESCE(earned.earned, 0)
  ), 0), 3)
  INTO v_commissions
  FROM public.employees e
  LEFT JOIN earned_per_invoice earned ON earned.employee_id = e.id
  WHERE e.center_id = p_center_id AND e.is_active = TRUE;

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'base_salaries', v_base_salaries,
    'commissions', v_commissions,
    'expenses', v_expenses,
    'profit', round(v_revenue - v_base_salaries - v_commissions - v_expenses, 3)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Grants (signatures unchanged; re-asserted for determinism).
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_dashboard_pnl_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_pnl_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMIT;

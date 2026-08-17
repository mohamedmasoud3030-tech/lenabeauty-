-- =============================================================================
-- LenaBeauty — role-governed, liability-aware dashboard reporting
-- =============================================================================
-- Keeps operational counts available to center members while exposing money,
-- expenses and compensation only to center ADMIN users. Earned revenue excludes
-- VAT and prepaid gift-card/package sales, and includes ledger redemptions.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary_v1(
  p_center_id UUID,
  p_day_start TIMESTAMPTZ,
  p_day_end TIMESTAMPTZ,
  p_month_start TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_customers BIGINT := 0;
  v_appointments BIGINT := 0;
  v_low_stock BIGINT := 0;
  v_new_customers BIGINT := 0;
  v_sales BIGINT := 0;
  v_earned NUMERIC(14,3) := 0;
  v_currency TEXT := 'OMR';
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;
  IF p_day_start IS NULL OR p_day_end IS NULL OR p_day_end <= p_day_start THEN
    RAISE EXCEPTION 'invalid_dashboard_day_range' USING ERRCODE = '22023';
  END IF;

  v_is_admin := app_private.has_center_role(p_center_id, ARRAY['ADMIN']);

  SELECT count(*) INTO v_customers FROM public.customers WHERE center_id = p_center_id;
  SELECT count(*) INTO v_appointments FROM public.appointments WHERE center_id = p_center_id;
  SELECT count(*) INTO v_low_stock
  FROM public.products
  WHERE center_id = p_center_id
    AND is_active = TRUE
    AND track_inventory = TRUE
    AND stock_quantity <= COALESCE(reorder_level, 5);
  SELECT count(*) INTO v_new_customers
  FROM public.customers
  WHERE center_id = p_center_id
    AND created_at >= COALESCE(p_month_start, date_trunc('month', p_day_start));
  SELECT COALESCE(currency, 'OMR') INTO v_currency
  FROM public.center_settings
  WHERE center_id = p_center_id;
  v_currency := COALESCE(v_currency, 'OMR');

  IF v_is_admin THEN
    WITH prepaid AS (
      SELECT ii.invoice_id,
             round(COALESCE(sum(ii.price * ii.quantity), 0), 3) AS amount
      FROM public.invoice_items ii
      JOIN public.invoices inv ON inv.id = ii.invoice_id
      WHERE inv.center_id = p_center_id
        AND inv.status = 'PAID'
        AND inv.date >= p_day_start AND inv.date < p_day_end
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
    SELECT
      count(*),
      round(COALESCE(sum(greatest(
        inv.total_amount
        - COALESCE(inv.tax, 0)
        - COALESCE(prepaid.amount, 0)
        + COALESCE(redeemed.amount, inv.gift_card_discount, 0),
        0
      )), 0), 3)
    INTO v_sales, v_earned
    FROM public.invoices inv
    LEFT JOIN prepaid ON prepaid.invoice_id = inv.id
    LEFT JOIN redeemed ON redeemed.invoice_id = inv.id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= p_day_start AND inv.date < p_day_end;
  END IF;

  RETURN jsonb_build_object(
    'customers', v_customers,
    'appointments', v_appointments,
    'sales', CASE WHEN v_is_admin THEN v_sales ELSE 0 END,
    'revenue', CASE WHEN v_is_admin THEN v_earned ELSE 0 END,
    'today_revenue', CASE WHEN v_is_admin THEN v_earned ELSE 0 END,
    'can_view_revenue', v_is_admin,
    'low_stock_count', v_low_stock,
    'new_customers_this_month', v_new_customers,
    'currency', v_currency
  );
END;
$$;

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
    round(COALESCE(sum(COALESCE(base_salary, salary, 0)), 0), 3),
    round(COALESCE(sum(COALESCE(month_commission_total, 0)), 0), 3)
  INTO v_base_salaries, v_commissions
  FROM public.employees
  WHERE center_id = p_center_id AND is_active = TRUE;

  RETURN jsonb_build_object(
    'revenue', v_revenue,
    'base_salaries', v_base_salaries,
    'commissions', v_commissions,
    'expenses', v_expenses,
    'profit', round(v_revenue - v_base_salaries - v_commissions - v_expenses, 3)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_revenue_entries_v1(
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
  v_entries JSONB;
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
  ), earned AS (
    SELECT
      inv.id,
      inv.date,
      round(greatest(
        inv.total_amount
        - COALESCE(inv.tax, 0)
        - COALESCE(prepaid.amount, 0)
        + COALESCE(redeemed.amount, inv.gift_card_discount, 0),
        0
      ), 3) AS revenue
    FROM public.invoices inv
    LEFT JOIN prepaid ON prepaid.invoice_id = inv.id
    LEFT JOIN redeemed ON redeemed.invoice_id = inv.id
    WHERE inv.center_id = p_center_id
      AND inv.status = 'PAID'
      AND inv.date >= p_from AND inv.date < p_to
    ORDER BY inv.date
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'invoice_id', earned.id,
    'date', earned.date,
    'revenue', earned.revenue
  ) ORDER BY earned.date), '[]'::jsonb)
  INTO v_entries
  FROM earned;

  RETURN jsonb_build_object('entries', v_entries);
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_summary_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_pnl_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_dashboard_revenue_entries_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_pnl_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_revenue_entries_v1(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMIT;

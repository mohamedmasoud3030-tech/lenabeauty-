-- =============================================================================
-- LenaBeauty — Commission ledger + atomic payroll (P0/P1)
-- -----------------------------------------------------------------------------
-- 1. commission_ledger — append-only accrual of service commission on NET paid
--    service revenue (not a per-employee percentage field in isolation).
-- 2. Tips/gratuity — payments.tip + invoices.tips_amount so gratuity is
--    tracked separately from service revenue (and never commissioned).
-- 3. Atomic payroll RPCs — a single call creates the run, its line items, and
--    marks the deducted advances, replacing the multi-step frontend flow.
--
-- Net salary formula (matches src/domain/payroll.ts):
--   net_salary = max(0, base_salary + commission + tips - advances_deducted)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Commission ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  invoice_id       UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
  service_id       UUID REFERENCES public.services(id) ON DELETE RESTRICT,
  base_amount      NUMERIC(12,3) NOT NULL,
  rate             NUMERIC(5,2)  NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  period_month     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACCRUED',
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT commission_ledger_non_negative
    CHECK (base_amount >= 0 AND commission_amount >= 0),
  CONSTRAINT commission_ledger_status_valid
    CHECK (status IN ('ACCRUED', 'REVERSED', 'PAID'))
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_center_period
  ON public.commission_ledger(center_id, period_month);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_employee
  ON public.commission_ledger(center_id, employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_invoice
  ON public.commission_ledger(invoice_id);

-- One accrual per invoice: a retried checkout can never double-accrue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_ledger_one_accrual_per_invoice
  ON public.commission_ledger(invoice_id) WHERE status = 'ACCRUED';

ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_ledger_member_select ON public.commission_ledger;
CREATE POLICY commission_ledger_member_select ON public.commission_ledger
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

REVOKE INSERT, UPDATE, DELETE ON public.commission_ledger FROM anon, authenticated;
GRANT SELECT ON public.commission_ledger TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tips / gratuity + COGS columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS tip NUMERIC(12,3) NOT NULL DEFAULT 0
  CHECK (tip >= 0 AND tip <> 'NaN'::numeric);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tips_amount NUMERIC(12,3) NOT NULL DEFAULT 0
  CHECK (tips_amount >= 0 AND tips_amount <> 'NaN'::numeric),
  ADD COLUMN IF NOT EXISTS cogs_amount NUMERIC(12,3) NOT NULL DEFAULT 0
  CHECK (cogs_amount >= 0 AND cogs_amount <> 'NaN'::numeric);

-- Split tenders produce one SUCCEEDED payment row per tender for the same
-- invoice. The single-success-per-invoice uniqueness is replaced by a full
-- balance check enforced inside the checkout RPC.
DROP INDEX IF EXISTS public.idx_payments_one_success_per_invoice;

-- -----------------------------------------------------------------------------
-- 3. Payroll line items: commission + tips columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.payroll_line_items
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tips_amount NUMERIC(12,3) NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 4. Commission accrual (net paid service revenue)
-- -----------------------------------------------------------------------------
-- Called by the checkout RPC after invoice + items + payment are written.
-- Discounts and redemptions are allocated across lines proportionally, so the
-- commissionable base is the NET service revenue actually paid, never the
-- gross catalog price.
CREATE OR REPLACE FUNCTION app_private.accrue_invoice_commission_v1(p_invoice_id UUID)
RETURNS NUMERIC(12,3)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invoice       public.invoices%ROWTYPE;
  v_service_total NUMERIC(12,3) := 0.000;
  v_subtotal      NUMERIC(12,3) := 0.000;
  v_net           NUMERIC(12,3) := 0.000;
  v_base          NUMERIC(12,3) := 0.000;
  v_rate          NUMERIC(5,2)  := 0.000;
  v_commission    NUMERIC(12,3) := 0.000;
BEGIN
  SELECT * INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 0.000;
  END IF;

  IF v_invoice.status <> 'PAID' OR v_invoice.employee_id IS NULL THEN
    RETURN 0.000;
  END IF;

  SELECT COALESCE(SUM(ii.price * ii.quantity), 0)
  INTO v_service_total
  FROM public.invoice_items ii
  WHERE ii.invoice_id = v_invoice.id
    AND ii.item_type = 'service';

  IF v_service_total <= 0 THEN
    RETURN 0.000;
  END IF;

  v_subtotal := COALESCE(v_invoice.subtotal_amount, 0);
  v_net := GREATEST(0.000,
    v_subtotal
    - COALESCE(v_invoice.manual_discount, 0)
    - COALESCE(v_invoice.tier_discount, 0)
    - COALESCE(v_invoice.loyalty_discount, 0)
    - COALESCE(v_invoice.gift_card_discount, 0)
    - COALESCE(v_invoice.entitlement_redemption, 0));

  -- Proportional allocation of the standing discounts across the invoice.
  v_base := CASE
    WHEN v_subtotal > 0 THEN round(v_net * (v_service_total / v_subtotal), 3)
    ELSE 0.000
  END;

  SELECT COALESCE(e.commission_percentage, 0) INTO v_rate
  FROM public.employees e
  WHERE e.id = v_invoice.employee_id;

  IF v_rate <= 0 OR v_base <= 0 THEN
    RETURN 0.000;
  END IF;

  v_commission := round(v_base * v_rate / 100.0, 3);

  INSERT INTO public.commission_ledger (
    center_id, employee_id, invoice_id, base_amount, rate,
    commission_amount, period_month, status, reason
  ) VALUES (
    v_invoice.center_id, v_invoice.employee_id, v_invoice.id, v_base, v_rate,
    v_commission, to_char(v_invoice.date, 'YYYY-MM'), 'ACCRUED',
    'Service commission on net paid services'
  )
  ON CONFLICT (invoice_id) WHERE status = 'ACCRUED' DO NOTHING;

  RETURN v_commission;
END;
$$;

REVOKE ALL ON FUNCTION app_private.accrue_invoice_commission_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.accrue_invoice_commission_v1(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Atomic payroll run creation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payroll_run_v1(
  p_center_id    UUID,
  p_period_month TEXT,
  p_notes        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_run             public.payroll_runs%ROWTYPE;
  v_employee        public.employees%ROWTYPE;
  v_month_start     DATE;
  v_month_end       DATE;
  v_advances        NUMERIC(12,3);
  v_commission      NUMERIC(12,3);
  v_tips            NUMERIC(12,3);
  v_net             NUMERIC(12,3);
  v_base            NUMERIC(12,3);
  v_advance_ids     UUID[];
  v_deducted_ids    UUID[];
  v_lines_json      JSONB;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, 'ADMIN', 'MANAGER') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_period_month IS NULL OR p_period_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'invalid_period_month' USING ERRCODE = '22023';
  END IF;

  v_month_start := (p_period_month || '-01')::date;
  v_month_end   := (v_month_start + interval '1 month')::date;

  -- One finalized run per month (UNIQUE(center_id, period_month) backs this).
  PERFORM 1 FROM public.payroll_runs pr
  WHERE pr.center_id = p_center_id AND pr.period_month = p_period_month
  FOR UPDATE;
  IF FOUND THEN
    RAISE EXCEPTION 'payroll_run_exists' USING ERRCODE = '23505';
  END IF;

  -- Approve-then-deduct advances in one place; nothing is partially applied.
  SELECT COALESCE(array_agg(ea.id ORDER BY ea.advance_date), ARRAY[]::UUID[])
  INTO v_advance_ids
  FROM public.employee_advances ea
  WHERE ea.center_id = p_center_id
    AND ea.status = 'APPROVED'
    AND ea.advance_date >= v_month_start
    AND ea.advance_date < v_month_end;

  INSERT INTO public.payroll_runs (center_id, period_month, notes)
  VALUES (p_center_id, p_period_month, NULLIF(btrim(COALESCE(p_notes, '')), ''))
  RETURNING * INTO v_run;

  FOR v_employee IN
    SELECT * FROM public.employees e
    WHERE e.center_id = p_center_id AND e.is_active = true
    ORDER BY e.name
  LOOP
    v_base := COALESCE(v_employee.base_salary, v_employee.salary, 0);

    SELECT COALESCE(SUM(ea.amount), 0)
    INTO v_advances
    FROM public.employee_advances ea
    WHERE ea.center_id = p_center_id
      AND ea.employee_id = v_employee.id
      AND ea.status = 'APPROVED'
      AND ea.advance_date >= v_month_start
      AND ea.advance_date < v_month_end;

    SELECT COALESCE(SUM(cl.commission_amount), 0)
    INTO v_commission
    FROM public.commission_ledger cl
    WHERE cl.center_id = p_center_id
      AND cl.employee_id = v_employee.id
      AND cl.period_month = p_period_month
      AND cl.status = 'ACCRUED';

    SELECT COALESCE(SUM(i.tips_amount), 0)
    INTO v_tips
    FROM public.invoices i
    WHERE i.center_id = p_center_id
      AND i.employee_id = v_employee.id
      AND i.status = 'PAID'
      AND i.date >= v_month_start
      AND i.date < v_month_end;

    v_net := GREATEST(0.000, round(v_base + v_commission + v_tips - v_advances, 3));

    INSERT INTO public.payroll_line_items (
      center_id, payroll_run_id, employee_id, base_salary,
      commission_amount, tips_amount, advances_deducted, net_salary
    ) VALUES (
      p_center_id, v_run.id, v_employee.id, v_base,
      v_commission, v_tips, v_advances, v_net
    );
  END LOOP;

  -- Mark deducted advances so a later run cannot double-count them.
  UPDATE public.employee_advances ea
  SET status = 'DEDUCTED',
      deducted_in_run_id = v_run.id,
      updated_at = now()
  WHERE ea.center_id = p_center_id
    AND ea.id = ANY(v_advance_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(pli) ORDER BY pli.created_at, pli.id), '[]'::jsonb)
  INTO v_lines_json
  FROM public.payroll_line_items pli
  WHERE pli.payroll_run_id = v_run.id;

  RETURN jsonb_build_object(
    'run', to_jsonb(v_run),
    'lines', v_lines_json
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Atomic payroll run deletion (releases advances, removes run + lines)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_payroll_run_v1(
  p_center_id UUID,
  p_run_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted BOOLEAN := false;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, 'ADMIN', 'MANAGER') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  -- Release advances so a corrected run can deduct them again.
  UPDATE public.employee_advances ea
  SET status = 'APPROVED',
      deducted_in_run_id = NULL,
      updated_at = now()
  WHERE ea.center_id = p_center_id
    AND ea.deducted_in_run_id = p_run_id;

  DELETE FROM public.payroll_runs pr
  WHERE pr.id = p_run_id AND pr.center_id = p_center_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF NOT v_deleted THEN
    RAISE EXCEPTION 'payroll_run_not_found' USING ERRCODE = '23503';
  END IF;

  RETURN jsonb_build_object('deleted', true, 'run_id', p_run_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Grants
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_payroll_run_v1(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_payroll_run_v1(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_payroll_run_v1(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_payroll_run_v1(UUID, UUID) TO authenticated;

COMMIT;

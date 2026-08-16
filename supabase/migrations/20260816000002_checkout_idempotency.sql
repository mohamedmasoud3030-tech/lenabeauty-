-- =============================================================================
-- LenaBeauty — idempotent financial checkout boundary
-- =============================================================================
-- A stable client request UUID makes transport retries return the original
-- committed result instead of posting a second invoice/payment/stock deduction.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.checkout_idempotency (
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE RESTRICT,
  request_id UUID NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (center_id, request_id),
  CONSTRAINT checkout_idempotency_result_consistent CHECK (
    (result IS NULL AND invoice_id IS NULL AND completed_at IS NULL)
    OR (result IS NOT NULL AND invoice_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_idempotency FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_checkout_idempotent_v1(
  p_request_id UUID,
  p_center_id UUID,
  p_customer_id UUID,
  p_employee_id UUID,
  p_payment_method TEXT,
  p_discount_amount NUMERIC,
  p_use_loyalty_points BOOLEAN,
  p_items JSONB,
  p_gift_card_code TEXT DEFAULT NULL,
  p_entitlement_redemptions JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_result JSONB;
  v_invoice_id UUID;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'checkout_request_id_required' USING ERRCODE = '22023';
  END IF;
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;

  -- The unique key serializes concurrent requests carrying the same operation
  -- identity. PostgreSQL waits for an in-flight conflicting INSERT before the
  -- following SELECT, so the loser observes the winner's committed result.
  INSERT INTO public.checkout_idempotency(center_id, request_id)
  VALUES (p_center_id, p_request_id)
  ON CONFLICT (center_id, request_id) DO NOTHING;

  SELECT record.result
  INTO v_result
  FROM public.checkout_idempotency AS record
  WHERE record.center_id = p_center_id AND record.request_id = p_request_id
  FOR UPDATE;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  v_result := public.process_checkout_v1(
    p_center_id,
    p_customer_id,
    p_employee_id,
    p_payment_method,
    p_discount_amount,
    p_use_loyalty_points,
    p_items,
    p_gift_card_code,
    p_entitlement_redemptions
  );

  v_invoice_id := (v_result->'invoice'->>'id')::UUID;
  IF v_invoice_id IS NULL THEN
    RAISE EXCEPTION 'checkout_result_missing_invoice' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.checkout_idempotency
  SET result = v_result, invoice_id = v_invoice_id, completed_at = now()
  WHERE center_id = p_center_id AND request_id = p_request_id;

  RETURN v_result;
END;
$$;

-- The privileged legacy entry point remains callable by this wrapper's owner,
-- but clients must not bypass the idempotency boundary.
REVOKE ALL ON FUNCTION public.process_checkout_v1(
  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.process_checkout_idempotent_v1(
  UUID, UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_checkout_idempotent_v1(
  UUID, UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB
) TO authenticated;

COMMIT;

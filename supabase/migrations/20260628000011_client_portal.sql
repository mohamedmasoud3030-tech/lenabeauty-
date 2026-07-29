-- ============================================================
-- LenaBeauty — Client portal
-- Public OTP-less client access by phone number + portal token,
-- allowing a customer to view their appointments/invoices/loyalty profile.
-- ============================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_access_token TEXT,
  ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS portal_last_login_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_center_portal_token
  ON public.customers(center_id, portal_access_token)
  WHERE portal_access_token IS NOT NULL;

UPDATE public.customers
SET portal_access_token = substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12)
WHERE portal_access_token IS NULL;

CREATE OR REPLACE FUNCTION public.public_client_portal_login_v1(
  p_center_id UUID,
  p_phone TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
BEGIN
  IF p_center_id IS NULL THEN
    RAISE EXCEPTION 'Missing center id' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE center_id = p_center_id
    AND phone = NULLIF(btrim(COALESCE(p_phone, '')), '')
    AND portal_access_token = NULLIF(btrim(COALESCE(p_token, '')), '')
    AND portal_access_enabled = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid portal credentials' USING ERRCODE = '22023';
  END IF;

  UPDATE public.customers
  SET portal_last_login_at = now(),
      updated_at = now()
  WHERE id = v_customer.id;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone,
      'loyalty_points', v_customer.loyalty_points,
      'total_spent', v_customer.total_spent,
      'last_visit', v_customer.last_visit,
      'portal_last_login_at', now()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_client_portal_profile_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_phone TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
BEGIN
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND center_id = p_center_id
    AND phone = NULLIF(btrim(COALESCE(p_phone, '')), '')
    AND portal_access_token = NULLIF(btrim(COALESCE(p_token, '')), '')
    AND portal_access_enabled = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid portal credentials' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'notes', v_customer.notes,
      'loyalty_points', v_customer.loyalty_points,
      'total_spent', v_customer.total_spent,
      'last_visit', v_customer.last_visit,
      'portal_last_login_at', v_customer.portal_last_login_at
    ),
    'appointments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'date_time', a.date_time,
        'status', a.status,
        'notes', a.notes,
        'deposit_amount', COALESCE(a.deposit_amount, 0),
        'no_show_fee_amount', COALESCE(a.no_show_fee_amount, 0),
        'no_show_fee_charged', COALESCE(a.no_show_fee_charged, 0),
        'employee_name', e.name,
        'service_name', s.name
      ) ORDER BY a.date_time DESC), '[]'::jsonb)
      FROM public.appointments a
      LEFT JOIN public.employees e ON e.id = a.employee_id
      LEFT JOIN public.services s ON s.id = a.service_id
      WHERE a.customer_id = v_customer.id
        AND a.center_id = p_center_id
    ),
    'invoices', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'serial_number', i.serial_number,
        'date', i.date,
        'total_amount', i.total_amount,
        'discount', i.discount,
        'tax', COALESCE(i.tax, 0),
        'payment_method', i.payment_method
      ) ORDER BY i.date DESC), '[]'::jsonb)
      FROM public.invoices i
      WHERE i.customer_id = v_customer.id
        AND i.center_id = p_center_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_customer_portal_token_v1(
  p_center_id UUID,
  p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_token TEXT;
  v_customer public.customers%ROWTYPE;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'Unauthorized client portal center' USING ERRCODE = '42501';
  END IF;

  v_token := substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);

  UPDATE public.customers
  SET portal_access_token = v_token,
      updated_at = now()
  WHERE id = p_customer_id
    AND center_id = p_center_id
  RETURNING * INTO v_customer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer is not available for this center' USING ERRCODE = '23503';
  END IF;

  RETURN jsonb_build_object(
    'customer_id', v_customer.id,
    'portal_access_token', v_customer.portal_access_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_client_portal_login_v1(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_client_portal_profile_v1(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_client_portal_login_v1(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_client_portal_profile_v1(UUID, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) TO authenticated;

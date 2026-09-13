-- -----------------------------------------------------------------------------
-- Customer ratings — self-service review capture.
--
-- The customer experiences the service, so the customer writes the rating.
-- Staff never fill this in. Two entry points write to the same
-- customer_reviews row model:
--
--   1. Client portal  — the customer (phone + portal code, identical auth to
--      cancel/reschedule) rates a completed appointment from #/portal.
--   2. Receipt QR     — the printed receipt's QR opens
--      #/rate?invoice=<id>; possession of the invoice id is the credential
--      (the same identifiers are already printed on the paper).
--
-- Uniqueness:
--   * one rating per appointment — the pre-existing partial unique index
--     idx_customer_reviews_one_per_appointment (appointment_id IS NOT NULL)
--     makes the upsert deterministic, latest wins;
--   * walk-in invoices (no appointment) update the customer's newest
--     "general" review in place, so repeated scans never multiply rows
--     (no new unique index: salons may already hold several general reviews
--     created from the signed-in review form).
--
-- Grants follow the release pattern: REVOKE from PUBLIC, GRANT to
-- anon + authenticated only, and the table guardrails are re-asserted so a
-- drift audit can diff this file.
-- -----------------------------------------------------------------------------

BEGIN;

-- 1. Portal: rate a visit (customer credentials).
CREATE OR REPLACE FUNCTION public.public_client_portal_rate_visit_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_appointment_id UUID,
  p_phone TEXT,
  p_token TEXT,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_review public.customer_reviews%ROWTYPE;
  v_comment TEXT;
BEGIN
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING ERRCODE = '22023';
  END IF;

  v_comment := left(NULLIF(btrim(COALESCE(p_comment, '')), ''), 500);

  SELECT *
  INTO v_customer
  FROM public.customers
  WHERE center_id = p_center_id
    AND id = p_customer_id
    AND phone = NULLIF(btrim(COALESCE(p_phone, '')), '')
    AND portal_access_token = NULLIF(btrim(COALESCE(p_token, '')), '')
    AND portal_access_enabled = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_portal_credentials' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
    AND center_id = p_center_id
    AND customer_id = v_customer.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.customer_reviews
    (center_id, customer_id, appointment_id, rating, comment, is_published, created_at, updated_at)
  VALUES
    (v_customer.center_id, v_customer.id, v_appointment.id, p_rating, v_comment, TRUE, now(), now())
  ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
  DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        is_published = TRUE,
        updated_at = now()
  RETURNING * INTO v_review;

  RETURN jsonb_build_object(
    'id', v_review.id,
    'appointment_id', v_review.appointment_id,
    'rating', v_review.rating,
    'comment', v_review.comment,
    'is_published', v_review.is_published,
    'created_at', v_review.created_at
  );
END;
$$;

-- 2. Receipt: look up what a scanned invoice points to (read-only).
CREATE OR REPLACE FUNCTION public.public_invoice_rating_lookup_v1(
  p_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_existing SMALLINT;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT r.rating
  INTO v_existing
  FROM public.customer_reviews r
  WHERE r.center_id = v_invoice.center_id
    AND r.customer_id = v_invoice.customer_id
    AND r.appointment_id IS NOT DISTINCT FROM v_invoice.appointment_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'center_id', v_invoice.center_id,
    'center_name', (SELECT c.name FROM public.centers c WHERE c.id = v_invoice.center_id),
    'invoice_id', v_invoice.id,
    'date', v_invoice.date,
    'total_amount', v_invoice.total_amount,
    'appointment_id', v_invoice.appointment_id,
    'service_name', (
      SELECT s.name
      FROM public.appointments a
      JOIN public.services s ON s.id = a.service_id
      WHERE a.id = v_invoice.appointment_id
    ),
    'employee_name', (
      SELECT e.name
      FROM public.appointments a
      JOIN public.employees e ON e.id = a.employee_id
      WHERE a.id = v_invoice.appointment_id
    ),
    'existing_rating', v_existing
  );
END;
$$;

-- 3. Receipt: rate the visit behind a scanned invoice (write).
CREATE OR REPLACE FUNCTION public.public_invoice_rate_visit_v1(
  p_invoice_id UUID,
  p_rating SMALLINT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices%ROWTYPE;
  v_review public.customer_reviews%ROWTYPE;
  v_comment TEXT;
BEGIN
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING ERRCODE = '22023';
  END IF;

  v_comment := left(NULLIF(btrim(COALESCE(p_comment, '')), ''), 500);

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invoice_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_invoice.appointment_id IS NOT NULL THEN
    INSERT INTO public.customer_reviews
      (center_id, customer_id, appointment_id, rating, comment, is_published, created_at, updated_at)
    VALUES
      (v_invoice.center_id, v_invoice.customer_id, v_invoice.appointment_id, p_rating, v_comment, TRUE, now(), now())
    ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL
    DO UPDATE
      SET rating = EXCLUDED.rating,
          comment = EXCLUDED.comment,
          is_published = TRUE,
          updated_at = now()
    RETURNING * INTO v_review;
  ELSE
    -- Walk-in invoice: update the customer's newest general review in place
    -- (idempotent for repeated scans); create one when none exists.
    SELECT * INTO v_review
    FROM public.customer_reviews
    WHERE center_id = v_invoice.center_id
      AND customer_id = v_invoice.customer_id
      AND appointment_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.customer_reviews
      SET rating = p_rating,
          comment = v_comment,
          is_published = TRUE,
          updated_at = now()
      WHERE id = v_review.id
      RETURNING * INTO v_review;
    ELSE
      INSERT INTO public.customer_reviews
        (center_id, customer_id, appointment_id, rating, comment, is_published, created_at, updated_at)
      VALUES
        (v_invoice.center_id, v_invoice.customer_id, NULL, p_rating, v_comment, TRUE, now(), now())
      RETURNING * INTO v_review;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_review.id,
    'appointment_id', v_review.appointment_id,
    'rating', v_review.rating,
    'comment', v_review.comment,
    'is_published', v_review.is_published,
    'created_at', v_review.created_at
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Grants (release pattern): never PUBLIC, always anon + authenticated.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.public_client_portal_rate_visit_v1(UUID, UUID, UUID, TEXT, TEXT, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_client_portal_rate_visit_v1(UUID, UUID, UUID, TEXT, TEXT, SMALLINT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_invoice_rating_lookup_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_invoice_rating_lookup_v1(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_invoice_rate_visit_v1(UUID, SMALLINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_invoice_rate_visit_v1(UUID, SMALLINT, TEXT) TO anon, authenticated;

-- Guardrails: tables stay fully closed to anon (statements, not policy).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

COMMIT;

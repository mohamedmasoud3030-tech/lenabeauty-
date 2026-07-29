BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_from_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_source TEXT NOT NULL DEFAULT 'INTERNAL';

UPDATE public.appointments
SET booking_source = COALESCE(NULLIF(booking_source, ''), 'INTERNAL');

CREATE OR REPLACE FUNCTION public.public_cancel_booking_v1(
  p_center_id UUID,
  p_appointment_id UUID,
  p_phone TEXT,
  p_portal_token TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment public.appointments;
  v_customer public.customers;
BEGIN
  SELECT a.*
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.center_id = p_center_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.customers c
  WHERE c.id = v_appointment.customer_id
    AND c.center_id = p_center_id
    AND COALESCE(c.phone, '') = COALESCE(p_phone, '')
    AND c.portal_access_enabled = TRUE
    AND c.portal_access_token = p_portal_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_portal_credentials';
  END IF;

  IF v_appointment.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'only_scheduled_can_be_cancelled';
  END IF;

  IF v_appointment.date_time <= now() THEN
    RAISE EXCEPTION 'cannot_cancel_past_or_started_appointment';
  END IF;

  UPDATE public.appointments
  SET status = 'CANCELLED',
      cancellation_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
      cancelled_at = now(),
      updated_at = now()
  WHERE id = v_appointment.id
  RETURNING * INTO v_appointment;

  RETURN jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'action', 'CANCELLED'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.public_reschedule_booking_v1(
  p_center_id UUID,
  p_appointment_id UUID,
  p_phone TEXT,
  p_portal_token TEXT,
  p_new_date_time TIMESTAMPTZ,
  p_new_employee_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment public.appointments;
  v_customer public.customers;
  v_employee_id UUID;
BEGIN
  SELECT a.*
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.center_id = p_center_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.customers c
  WHERE c.id = v_appointment.customer_id
    AND c.center_id = p_center_id
    AND COALESCE(c.phone, '') = COALESCE(p_phone, '')
    AND c.portal_access_enabled = TRUE
    AND c.portal_access_token = p_portal_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_portal_credentials';
  END IF;

  IF v_appointment.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'only_scheduled_can_be_rescheduled';
  END IF;

  IF v_appointment.date_time <= now() THEN
    RAISE EXCEPTION 'cannot_reschedule_past_or_started_appointment';
  END IF;

  IF p_new_date_time IS NULL OR p_new_date_time <= now() THEN
    RAISE EXCEPTION 'new_time_must_be_in_future';
  END IF;

  v_employee_id := COALESCE(p_new_employee_id, v_appointment.employee_id);

  IF v_employee_id IS NOT NULL THEN
    PERFORM 1 FROM public.employees e
    WHERE e.id = v_employee_id AND e.center_id = p_center_id AND e.is_active = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'selected_staff_not_available';
    END IF;

    PERFORM 1 FROM public.appointments a
    WHERE a.center_id = p_center_id
      AND a.id <> v_appointment.id
      AND a.employee_id = v_employee_id
      AND a.status = 'SCHEDULED'
      AND a.date_time = p_new_date_time;
    IF FOUND THEN
      RAISE EXCEPTION 'this_time_slot_is_no_longer_available';
    END IF;
  END IF;

  UPDATE public.appointments
  SET date_time = p_new_date_time,
      employee_id = v_employee_id,
      notes = CASE
        WHEN NULLIF(trim(COALESCE(p_reason, '')), '') IS NULL THEN notes
        ELSE CONCAT(COALESCE(notes || E'\n', ''), 'Reschedule note: ', NULLIF(trim(COALESCE(p_reason, '')), ''))
      END,
      rescheduled_at = now(),
      updated_at = now()
  WHERE id = v_appointment.id
  RETURNING * INTO v_appointment;

  RETURN jsonb_build_object(
    'appointment', to_jsonb(v_appointment),
    'action', 'RESCHEDULED'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_cancel_booking_v1(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_reschedule_booking_v1(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_cancel_booking_v1(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_reschedule_booking_v1(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT) TO anon, authenticated;

COMMIT;

-- ============================================================
-- LenaBeauty — Public Online Booking
--
-- Lets prospective clients self-book 24/7 from a public page WITHOUT a login.
-- Anonymous users cannot touch tables directly (RLS denies them), so booking
-- goes through SECURITY DEFINER RPCs granted to the `anon` role, with strict
-- validation. Two read RPCs expose only the minimum needed for the booking UI.
--
-- HOW TO RUN: Supabase SQL Editor, AFTER the previous migrations.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Public read: active services for a center (id, name, price, duration)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_list_services_v1(p_center_id UUID)
RETURNS TABLE (id UUID, name TEXT, price NUMERIC, duration_minutes INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.price, s.duration_minutes
  FROM public.services s
  WHERE s.center_id = p_center_id AND s.is_active = true
  ORDER BY s.name;
$$;

-- ------------------------------------------------------------
-- 2. Public read: active staff for a center (id, name only)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_list_staff_v1(p_center_id UUID)
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name
  FROM public.employees e
  WHERE e.center_id = p_center_id AND e.is_active = true
  ORDER BY e.name;
$$;

-- ------------------------------------------------------------
-- 3. Public read: center display name (for the booking page header)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_center_info_v1(p_center_id UUID)
RETURNS TABLE (name TEXT, currency TEXT, phone TEXT, address TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.name, cs.currency, cs.phone, cs.address
  FROM public.center_settings cs
  WHERE cs.center_id = p_center_id;
$$;

-- ------------------------------------------------------------
-- 4. Public read: taken slot start-times for a given day (to grey out)
--    Returns only timestamps of SCHEDULED appointments — no PII.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_taken_slots_v1(p_center_id UUID, p_day DATE)
RETURNS TABLE (date_time TIMESTAMPTZ, employee_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.date_time, a.employee_id
  FROM public.appointments a
  WHERE a.center_id = p_center_id
    AND a.status = 'SCHEDULED'
    AND a.date_time >= p_day::timestamptz
    AND a.date_time <  (p_day + 1)::timestamptz;
$$;

-- ------------------------------------------------------------
-- 5. Public write: create a booking (find-or-create customer by phone)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_create_booking_v1(
    p_center_id     UUID,
    p_service_id    UUID,
    p_employee_id   UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_date_time     TIMESTAMPTZ,
    p_notes         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_customer_id  UUID;
    v_appt_id      UUID;
    v_clean_name   TEXT := NULLIF(btrim(COALESCE(p_customer_name, '')), '');
    v_clean_phone  TEXT := NULLIF(btrim(COALESCE(p_customer_phone, '')), '');
BEGIN
    -- Basic validation
    IF p_center_id IS NULL OR p_service_id IS NULL OR p_date_time IS NULL THEN
        RAISE EXCEPTION 'Missing required booking fields' USING ERRCODE = '22023';
    END IF;
    IF v_clean_name IS NULL OR v_clean_phone IS NULL THEN
        RAISE EXCEPTION 'Name and phone are required' USING ERRCODE = '22023';
    END IF;
    IF length(v_clean_phone) < 6 OR length(v_clean_phone) > 20 THEN
        RAISE EXCEPTION 'Invalid phone number' USING ERRCODE = '22023';
    END IF;
    IF p_date_time < now() THEN
        RAISE EXCEPTION 'Cannot book a time in the past' USING ERRCODE = '22023';
    END IF;

    -- Service must exist, belong to the center, and be active
    PERFORM 1 FROM public.services s
    WHERE s.id = p_service_id AND s.center_id = p_center_id AND s.is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service is not available' USING ERRCODE = '23503';
    END IF;

    -- Optional employee must belong to the center and be active
    IF p_employee_id IS NOT NULL THEN
        PERFORM 1 FROM public.employees e
        WHERE e.id = p_employee_id AND e.center_id = p_center_id AND e.is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Selected staff is not available' USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Prevent double-booking the same staff at the same time
    IF p_employee_id IS NOT NULL THEN
        PERFORM 1 FROM public.appointments a
        WHERE a.center_id = p_center_id
          AND a.employee_id = p_employee_id
          AND a.status = 'SCHEDULED'
          AND a.date_time = p_date_time;
        IF FOUND THEN
            RAISE EXCEPTION 'This time slot is no longer available' USING ERRCODE = '23505';
        END IF;
    END IF;

    -- Find existing customer by phone within the center, else create one
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.center_id = p_center_id AND c.phone = v_clean_phone
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (center_id, name, phone)
        VALUES (p_center_id, v_clean_name, v_clean_phone)
        RETURNING id INTO v_customer_id;
    END IF;

    -- Create the appointment
    INSERT INTO public.appointments (center_id, customer_id, employee_id, service_id, date_time, status, notes)
    VALUES (p_center_id, v_customer_id, p_employee_id, p_service_id, p_date_time, 'SCHEDULED', NULLIF(btrim(COALESCE(p_notes,'')), ''))
    RETURNING id INTO v_appt_id;

    RETURN jsonb_build_object(
        'appointment_id', v_appt_id,
        'customer_id',    v_customer_id,
        'status',         'SCHEDULED'
    );
END;
$$;

-- ------------------------------------------------------------
-- 6. Grants — expose ONLY these RPCs to anonymous + authenticated callers.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.public_list_services_v1(UUID)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_list_staff_v1(UUID)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_center_info_v1(UUID)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_taken_slots_v1(UUID, DATE)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_list_services_v1(UUID)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_list_staff_v1(UUID)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_center_info_v1(UUID)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_taken_slots_v1(UUID, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated;

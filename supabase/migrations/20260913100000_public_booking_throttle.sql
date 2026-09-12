-- =============================================================================
-- LenaBeauty — Public-surface throttle (abuse protection for #/book).
--
-- `#/book` and `#/portal` are reachable by anyone holding the publishable key,
-- which ships inside the browser bundle. Until now nothing limited how often a
-- stranger could call them:
--
--   * public_create_booking_v1 creates a customer row and an appointment row per
--     accepted call, and the only checks were field validation and a staff/time
--     collision — a script could fill a salon's calendar (and its customer list)
--     at machine speed;
--   * public_cancel_booking_v1 / public_reschedule_booking_v1 verify a phone
--     number plus a portal code with no failure counter — unlike
--     public_client_portal_login_v1, which has had a lockout since
--     20260628000014 — so the same credential could be guessed without limit.
--
-- This migration adds ONE mechanism — a windowed counter in a table nobody but
-- the SECURITY DEFINER functions can touch — and applies it to the write paths.
-- Limits are deliberately generous, because a false refusal costs a real
-- booking:
--
--   * bookings per phone:  5 per hour   (a client with a genuine need reschedules
--                                        rather than re-books five times)
--   * bookings per center: 120 per hour (2/minute sustained; far above the
--                                        online-booking volume of a salon that
--                                        also takes walk-ins and phone calls)
--   * credential attempts per phone on cancel/reschedule: 10 per hour
--
-- Reads (services, staff, slots, center info) are not throttled: they touch no
-- rows, and their cost is already bounded. The write paths are where an
-- anonymous caller can change data.
--
-- The three functions keep their exact signatures, so the grants asserted by
-- 20260912110000_public_booking_release.sql keep applying; their bodies are
-- copied verbatim from the migrations that shipped them, so the public contract
-- cannot drift while it gains protection.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. The counter. One row per (center, action, subject, window).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.public_request_throttle (
  center_id    UUID        NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  action       TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (center_id, action, subject, window_start)
);

COMMENT ON TABLE public.public_request_throttle IS
  'Windowed counters for the anonymous public surface. Written only by app_private.throttle_public_action(); not readable or writable by anon or authenticated.';

-- The age sweep in the helper scans by window_start.
CREATE INDEX IF NOT EXISTS idx_public_request_throttle_window
  ON public.public_request_throttle (window_start);

ALTER TABLE public.public_request_throttle ENABLE ROW LEVEL SECURITY;

-- No policies: nothing but a SECURITY DEFINER function may see this table. The
-- grants are revoked explicitly too, so a future policy cannot accidentally
-- expose it (defense in depth, matching 20260912110000).
REVOKE ALL ON TABLE public.public_request_throttle FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. The mechanism: count this call, refuse it once it exceeds the window.
--    Raises 'rate_limited' — a translatable code, never an internal message.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.throttle_public_action(
  p_center_id UUID,
  p_action    TEXT,
  p_subject   TEXT,
  p_limit     INTEGER,
  p_window    INTERVAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_hits         INTEGER;
BEGIN
  IF p_center_id IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_window IS NULL THEN
    RETURN;  -- misconfiguration must never block a real booking
  END IF;

  -- Buckets are anchored to the clock at their first hit, so a caller cannot
  -- reset its own allowance by waiting for a calendar boundary.
  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / extract(epoch FROM p_window)) * extract(epoch FROM p_window)
  );

  INSERT INTO public.public_request_throttle (center_id, action, subject, window_start, hits)
  VALUES (p_center_id, p_action, COALESCE(NULLIF(btrim(COALESCE(p_subject, '')), ''), '-'), v_window_start, 1)
  ON CONFLICT (center_id, action, subject, window_start)
  DO UPDATE SET hits = public.public_request_throttle.hits + 1
  RETURNING hits INTO v_hits;

  -- Opportunistic sweep: keep the table small without a scheduled job. Bounded
  -- by the index above, and cheap enough to run on a write path.
  DELETE FROM public.public_request_throttle
  WHERE window_start < now() - INTERVAL '1 day';

  IF v_hits > p_limit THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '42900';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION app_private.throttle_public_action(UUID, TEXT, TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- NOT DONE HERE: counting REFUSED attempts (wrong portal code in a cancel or
-- reschedule call). It is not an oversight — it cannot work this way. A plpgsql
-- function that increments a counter and then RAISE EXCEPTIONs loses the
-- increment, because the raise aborts the caller's transaction and PostgREST
-- rolls it back. Measured, not assumed: `public-booking-throttle.test.mjs`
-- proves it, and in doing so shows that the shipped portal lockout
-- (20260628000014_client_portal_lockout.sql) can never lock anybody out — it
-- increments `portal_failed_login_attempts` on the line before it raises
-- 'Invalid portal credentials'. Making that class of counter effective means
-- returning a refusal instead of raising it, which changes the public contract
-- those functions already have with the deployed app. That is a product
-- decision, and it is recorded as such rather than half-shipped here.
--
-- What this migration therefore protects: the create path, i.e. the only public
-- call that allocates rows (a customer and an appointment per invocation) for a
-- caller who has proven nothing.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 3. public_create_booking_v1 — the shipped body, with two documented changes:
--    the counters (see the note above), and a guard for a missing specialist
--    that used to surface the appointments trigger's internal name to a visitor.
--    Everything else is copied from 20260628000006_public_booking.sql, so the
--    public contract cannot drift while it gains protection.
-- -----------------------------------------------------------------------------
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

    -- The appointments trigger (20260810000002) requires a staff member on every
    -- appointment, so the "optional employee" this function used to describe was
    -- fiction: omitting one reached the visitor as the trigger's own name,
    -- `appointment_customer_service_staff_time_required`. The booking page always
    -- sends the specialist the client chose, so nothing that works today changes;
    -- what changes is that a scripted caller gets the salon's words, not ours.
    IF p_employee_id IS NULL THEN
        RAISE EXCEPTION 'Selected staff is not available' USING ERRCODE = '23503';
    END IF;

    PERFORM 1 FROM public.employees e
    WHERE e.id = p_employee_id AND e.center_id = p_center_id AND e.is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected staff is not available' USING ERRCODE = '23503';
    END IF;

    -- Abuse protection. Counted here — after validation, before the writes —
    -- because a counter write is only observable when the surrounding call
    -- commits: see the note on refused attempts at the top of this file. Keeping
    -- it after validation also stops a mistyped form from consuming a client's
    -- allowance, and stops a bogus center id from reaching the counter table's
    -- foreign key, whose message would name an internal table to a stranger.
    PERFORM app_private.throttle_public_action(p_center_id, 'booking', v_clean_phone, 5, INTERVAL '1 hour');
    PERFORM app_private.throttle_public_action(p_center_id, 'booking', 'center', 120, INTERVAL '1 hour');

    -- Prevent double-booking the same staff at the same time
    PERFORM 1 FROM public.appointments a
    WHERE a.center_id = p_center_id
      AND a.employee_id = p_employee_id
      AND a.status = 'SCHEDULED'
      AND a.date_time = p_date_time;
    IF FOUND THEN
        RAISE EXCEPTION 'This time slot is no longer available' USING ERRCODE = '23505';
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

-- -----------------------------------------------------------------------------
-- 5. Grants — the signature is unchanged, re-asserted so this file is
--    self-contained and a drift audit can diff it against the release migration.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_create_booking_v1(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO anon, authenticated;

COMMIT;

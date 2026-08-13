-- =============================================================================
-- LenaBeauty — Spa room / equipment resource booking (P2)
-- -----------------------------------------------------------------------------
-- Prevents double-booking of rooms and equipment with a database-level
-- exclusion constraint (safe under concurrent transactions), plus a buffer
-- window per resource so back-to-back bookings keep turnover/cleanup time.
--
-- Intended for Spa resource scheduling (rooms, lasers, devices, chairs):
--   * resources.resource_type = ROOM | EQUIPMENT
--   * resources.buffer_minutes pads the reserved window
--   * resource_bookings overlap is impossible for ACTIVE bookings
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'ROOM',
  buffer_minutes INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resources_type_valid CHECK (resource_type IN ('ROOM', 'EQUIPMENT')),
  CONSTRAINT resources_buffer_non_negative CHECK (buffer_minutes >= 0),
  CONSTRAINT resources_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT resources_center_name_unique UNIQUE (center_id, name)
);

CREATE INDEX IF NOT EXISTS idx_resources_center ON public.resources(center_id);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resources_member_select ON public.resources;
CREATE POLICY resources_member_select ON public.resources
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS resources_manager_insert ON public.resources;
CREATE POLICY resources_manager_insert ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

DROP POLICY IF EXISTS resources_manager_update ON public.resources;
CREATE POLICY resources_manager_update ON public.resources
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

DROP POLICY IF EXISTS resources_manager_delete ON public.resources;
CREATE POLICY resources_manager_delete ON public.resources
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

CREATE TABLE IF NOT EXISTS public.resource_bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  resource_id    UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  start_time     TIMESTAMPTZ NOT NULL,
  end_time       TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resource_bookings_status_valid
    CHECK (status IN ('ACTIVE', 'CANCELLED', 'COMPLETED')),
  CONSTRAINT resource_bookings_end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_resource_bookings_center_time
  ON public.resource_bookings(center_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource
  ON public.resource_bookings(resource_id, start_time);

-- The exclusion constraint makes ACTIVE double-bookings impossible even under
-- concurrent transactions. btree_gist (installed in the `extensions` schema by
-- the appointment-overlap migration) supplies the gist `=` opclass for UUID.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.resource_bookings'::regclass
      AND conname = 'resource_bookings_no_active_overlap'
  ) THEN
    ALTER TABLE public.resource_bookings
      ADD CONSTRAINT resource_bookings_no_active_overlap
      EXCLUDE USING gist (
        center_id WITH =,
        resource_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status = 'ACTIVE');
  END IF;
END;
$$;

ALTER TABLE public.resource_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resource_bookings_member_select ON public.resource_bookings;
CREATE POLICY resource_bookings_member_select ON public.resource_bookings
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

-- Bookings are created and cancelled through the governed RPCs below; direct
-- writes are reserved for ADMIN/MANAGER as a backstop.
DROP POLICY IF EXISTS resource_bookings_manager_insert ON public.resource_bookings;
CREATE POLICY resource_bookings_manager_insert ON public.resource_bookings
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

DROP POLICY IF EXISTS resource_bookings_manager_update ON public.resource_bookings;
CREATE POLICY resource_bookings_manager_update ON public.resource_bookings
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

-- -----------------------------------------------------------------------------
-- Governed reservation RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_resource_v1(
  p_center_id      UUID,
  p_resource_id    UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_start_time     TIMESTAMPTZ DEFAULT NULL,
  p_end_time       TIMESTAMPTZ DEFAULT NULL,
  p_notes          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_resource public.resources%ROWTYPE;
  v_booking  public.resource_bookings%ROWTYPE;
  v_start    TIMESTAMPTZ;
  v_end      TIMESTAMPTZ;
  v_buffer   INTERVAL;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_resource
  FROM public.resources r
  WHERE r.id = p_resource_id AND r.center_id = p_center_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = '23503';
  END IF;
  IF NOT v_resource.is_active THEN
    RAISE EXCEPTION 'resource_inactive' USING ERRCODE = '23514';
  END IF;

  v_start := COALESCE(p_start_time, now());
  v_end := p_end_time;
  IF v_end IS NULL THEN
    -- Default: one hour block.
    v_end := v_start + interval '1 hour';
  END IF;
  IF v_end <= v_start THEN
    RAISE EXCEPTION 'resource_booking_end_after_start' USING ERRCODE = '22023';
  END IF;

  IF p_appointment_id IS NOT NULL THEN
    PERFORM 1 FROM public.appointments a
    WHERE a.id = p_appointment_id AND a.center_id = p_center_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'appointment_not_in_center' USING ERRCODE = '23503';
    END IF;
  END IF;

  -- Buffer: pad the reserved window with the resource's turnover time so the
  -- exclusion constraint also protects cleanup between sessions.
  v_buffer := make_interval(mins => v_resource.buffer_minutes);

  INSERT INTO public.resource_bookings (
    center_id, resource_id, appointment_id, start_time, end_time, status, notes
  ) VALUES (
    p_center_id, p_resource_id, p_appointment_id,
    v_start - v_buffer, v_end + v_buffer, 'ACTIVE',
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING * INTO v_booking;

  RETURN jsonb_build_object('resource_booking', to_jsonb(v_booking));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_resource_v1(
  p_center_id      UUID,
  p_resource_id    UUID,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_booking public.resource_bookings%ROWTYPE;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  UPDATE public.resource_bookings rb
  SET status = 'CANCELLED'
  WHERE rb.center_id = p_center_id
    AND rb.resource_id = p_resource_id
    AND rb.status = 'ACTIVE'
    AND (p_appointment_id IS NULL OR rb.appointment_id = p_appointment_id)
  RETURNING * INTO v_booking;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resource_booking_not_found' USING ERRCODE = '23503';
  END IF;

  RETURN jsonb_build_object('resource_booking', to_jsonb(v_booking));
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_resource_v1(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_resource_v1(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_resource_v1(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.release_resource_v1(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_resource_v1(UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_resource_v1(UUID, UUID, UUID) TO authenticated;

COMMIT;

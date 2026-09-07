-- Status changes on booking requests must go through an ADMIN RPC.
-- Direct UPDATE on public.ai_booking_leads is revoked for authenticated
-- (authorization_boundary_repair); the previous table write failed with 42501.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_ai_booking_lead_status_v1(
  p_center_id UUID,
  p_lead_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_lead public.ai_booking_leads;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_lead_id IS NULL OR p_status NOT IN ('NEW', 'QUALIFIED', 'BOOKED', 'CLOSED') THEN
    RAISE EXCEPTION 'invalid_lead_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_booking_leads
  SET status = p_status
  WHERE id = p_lead_id AND center_id = p_center_id
  RETURNING * INTO v_lead;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'lead_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('lead', to_jsonb(v_lead));
END;
$$;

REVOKE ALL ON FUNCTION public.update_ai_booking_lead_status_v1(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ai_booking_lead_status_v1(UUID, UUID, TEXT) TO authenticated;

COMMIT;

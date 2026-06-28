-- ============================================================
-- LenaBeauty — No-Show protection
-- Adds optional appointment deposit + no-show fee tracking,
-- plus a hardened RPC to mark an appointment as no-show.
-- ============================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_fee_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_fee_charged NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS no_show_marked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_note TEXT;

CREATE OR REPLACE FUNCTION public.mark_appointment_no_show_v1(
  p_center_id UUID,
  p_appointment_id UUID,
  p_charge_no_show_fee BOOLEAN DEFAULT TRUE,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_charge NUMERIC(12,3) := 0;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'Unauthorized appointment center' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
    AND center_id = p_center_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment is not available for this center' USING ERRCODE = '23503';
  END IF;

  v_charge := CASE
    WHEN COALESCE(p_charge_no_show_fee, TRUE)
      THEN GREATEST(COALESCE(v_appt.deposit_amount, 0), COALESCE(v_appt.no_show_fee_amount, 0))
    ELSE 0
  END;

  UPDATE public.appointments
  SET status = 'NO_SHOW',
      no_show_fee_charged = v_charge,
      no_show_marked_at = now(),
      no_show_note = COALESCE(NULLIF(trim(p_note), ''), no_show_note),
      updated_at = now()
  WHERE id = p_appointment_id
    AND center_id = p_center_id;

  RETURN jsonb_build_object(
    'appointment', (
      SELECT to_jsonb(a)
      FROM public.appointments a
      WHERE a.id = p_appointment_id
    ),
    'charged_amount', v_charge
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_appointment_no_show_v1(UUID, UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_appointment_no_show_v1(UUID, UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- LenaBeauty — Self-service help: support tickets
-- Member-scoped ticket intake. No external platform; data
-- stays in the center's own database.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route TEXT,
  app_version TEXT,
  environment TEXT,
  role TEXT,
  error_reference TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  contact_email TEXT,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high')),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_center
  ON public.support_tickets(center_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS support_tickets_delete ON public.support_tickets;
CREATE POLICY support_tickets_delete ON public.support_tickets
  FOR DELETE TO authenticated
  USING (false);

-- Server-governed create: validates membership, trims input, and
-- enforces a max length on free-text fields to prevent abuse.
CREATE OR REPLACE FUNCTION public.create_support_ticket_v1(
  p_center_id UUID,
  p_route TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_error_reference TEXT DEFAULT NULL,
  p_expected_behavior TEXT DEFAULT NULL,
  p_actual_behavior TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_urgency TEXT DEFAULT 'normal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_ticket public.support_tickets;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_urgency NOT IN ('low', 'normal', 'high') THEN
    p_urgency := 'normal';
  END IF;

  IF length(btrim(COALESCE(p_expected_behavior, ''))) < 2
     AND length(btrim(COALESCE(p_actual_behavior, ''))) < 2 THEN
    RAISE EXCEPTION 'ticket_description_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.support_tickets (
    center_id, created_by, route, app_version, environment, role,
    error_reference, expected_behavior, actual_behavior, contact_email, urgency
  ) VALUES (
    p_center_id, auth.uid(),
    NULLIF(left(btrim(COALESCE(p_route, '')), 200), ''),
    NULLIF(left(btrim(COALESCE(p_app_version, '')), 32), ''),
    NULLIF(left(btrim(COALESCE(p_environment, '')), 32), ''),
    NULLIF(left(btrim(COALESCE(p_role, '')), 32), ''),
    NULLIF(left(btrim(COALESCE(p_error_reference, '')), 64), ''),
    NULLIF(left(btrim(COALESCE(p_expected_behavior, '')), 2000), ''),
    NULLIF(left(btrim(COALESCE(p_actual_behavior, '')), 2000), ''),
    NULLIF(left(btrim(COALESCE(p_contact_email, '')), 254), ''),
    p_urgency
  ) RETURNING * INTO v_ticket;

  RETURN jsonb_build_object('ticket', to_jsonb(v_ticket));
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket_v1(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket_v1(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;

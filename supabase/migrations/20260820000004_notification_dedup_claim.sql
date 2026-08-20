-- ============================================================
-- LenaBeauty — Atomic notification dedup claim
--
-- The earlier check_notification_dedup_v1 only SELECTed whether a
-- dedup_key existed; two concurrent senders could both pass the check
-- and both send. This migration adds a claim table with a unique
-- (center_id, dedup_key) constraint and a single INSERT ... ON CONFLICT
-- statement, which PostgreSQL executes atomically: exactly one caller
-- wins the claim per key within the retention window.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_dedup_claims (
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  dedup_key TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (center_id, dedup_key)
);

ALTER TABLE public.notification_dedup_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_dedup_claims_select ON public.notification_dedup_claims;
CREATE POLICY notification_dedup_claims_select ON public.notification_dedup_claims
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS notification_dedup_claims_insert ON public.notification_dedup_claims;
CREATE POLICY notification_dedup_claims_insert ON public.notification_dedup_claims
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS notification_dedup_claims_update ON public.notification_dedup_claims;
CREATE POLICY notification_dedup_claims_update ON public.notification_dedup_claims
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS notification_dedup_claims_delete ON public.notification_dedup_claims;
CREATE POLICY notification_dedup_claims_delete ON public.notification_dedup_claims
  FOR DELETE TO authenticated
  USING (false);

-- ------------------------------------------------------------
-- Atomic claim: INSERT ... ON CONFLICT DO NOTHING.
-- Returns TRUE when THIS caller won the claim (not a duplicate),
-- FALSE when the key was already claimed within the window.
-- Old claims are pruned first so expired keys can be claimed again.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_dedup_v1(
  p_center_id UUID,
  p_dedup_key TEXT,
  p_window_minutes INTEGER DEFAULT 1440
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_denied CONSTANT TEXT := 'insufficient_privilege';
  c_denied_code CONSTANT TEXT := '42501';
  v_claimed BOOLEAN;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION '%', c_denied USING ERRCODE = c_denied_code;
  END IF;
  IF p_dedup_key IS NULL OR length(trim(p_dedup_key)) = 0 THEN
    RAISE EXCEPTION 'invalid_dedup_key' USING ERRCODE = '22023';
  END IF;

  -- Prune expired claims so the key becomes claimable again.
  DELETE FROM public.notification_dedup_claims
  WHERE center_id = p_center_id
    AND claimed_at <= now() - make_interval(mins => p_window_minutes);

  INSERT INTO public.notification_dedup_claims (center_id, dedup_key)
  VALUES (p_center_id, p_dedup_key)
  ON CONFLICT (center_id, dedup_key) DO NOTHING
  RETURNING TRUE INTO v_claimed;

  RETURN COALESCE(v_claimed, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_dedup_v1(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_notification_dedup_v1(UUID, TEXT, INTEGER) TO authenticated;

-- ------------------------------------------------------------
-- Release a claim so a failed send can be retried within the window.
-- No-op when the key is not claimed (idempotent).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_notification_dedup_v1(
  p_center_id UUID,
  p_dedup_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_denied CONSTANT TEXT := 'insufficient_privilege';
  c_denied_code CONSTANT TEXT := '42501';
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION '%', c_denied USING ERRCODE = c_denied_code;
  END IF;

  DELETE FROM public.notification_dedup_claims
  WHERE center_id = p_center_id AND dedup_key = p_dedup_key;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.release_notification_dedup_v1(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_notification_dedup_v1(UUID, TEXT) TO authenticated;

COMMIT;

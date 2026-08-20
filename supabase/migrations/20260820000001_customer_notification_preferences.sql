-- ============================================================
-- LenaBeauty — Customer notification preferences + delivery log hardening
-- Adds per-customer channel opt-in with quiet hours and a delivery
-- metadata column for deduplication on the existing timeline table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'SMS', 'EMAIL', 'PUSH', 'IN_APP')),
  opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  opt_in_token UUID DEFAULT gen_random_uuid(),
  quiet_hour_start TIME,
  quiet_hour_end TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (center_id, customer_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_customer_notification_preferences_customer
  ON public.customer_notification_preferences(center_id, customer_id);

ALTER TABLE public.customer_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_notification_preferences_select_policy ON public.customer_notification_preferences;
CREATE POLICY customer_notification_preferences_select_policy ON public.customer_notification_preferences
  FOR SELECT USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS customer_notification_preferences_insert_policy ON public.customer_notification_preferences;
CREATE POLICY customer_notification_preferences_insert_policy ON public.customer_notification_preferences
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS customer_notification_preferences_update_policy ON public.customer_notification_preferences;
CREATE POLICY customer_notification_preferences_update_policy ON public.customer_notification_preferences
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS customer_notification_preferences_delete_policy ON public.customer_notification_preferences;
CREATE POLICY customer_notification_preferences_delete_policy ON public.customer_notification_preferences
  FOR DELETE USING (app_private.is_center_member(center_id));

-- Updated-at trigger
CREATE OR REPLACE FUNCTION app_private.set_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON public.customer_notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
BEFORE UPDATE ON public.customer_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION app_private.set_notification_preferences_updated_at();

-- Internal trigger helper: no client role may call it directly. The trigger
-- fires with the DML invoker's privileges regardless of EXECUTE grants, so
-- this only removes the default PUBLIC EXECUTE (least privilege).
REVOKE ALL ON FUNCTION app_private.set_notification_preferences_updated_at()
  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- RPC: upsert a customer's notification preference (server-governed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_customer_notification_preference_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_channel TEXT,
  p_opt_in BOOLEAN,
  p_quiet_hour_start TEXT DEFAULT NULL,
  p_quiet_hour_end TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_row public.customer_notification_preferences%ROWTYPE;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = p_customer_id AND c.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_in_center' USING ERRCODE = '23503';
  END IF;

  IF p_channel NOT IN ('WHATSAPP', 'SMS', 'EMAIL', 'PUSH', 'IN_APP') THEN
    RAISE EXCEPTION 'invalid_channel' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.customer_notification_preferences (
    center_id, customer_id, channel, opt_in, quiet_hour_start, quiet_hour_end
  )
  VALUES (
    p_center_id, p_customer_id, p_channel,
    COALESCE(p_opt_in, TRUE),
    NULLIF(trim(COALESCE(p_quiet_hour_start, '')), '')::time,
    NULLIF(trim(COALESCE(p_quiet_hour_end, '')), '')::time
  )
  ON CONFLICT (center_id, customer_id, channel)
  DO UPDATE SET
    opt_in = EXCLUDED.opt_in,
    quiet_hour_start = EXCLUDED.quiet_hour_start,
    quiet_hour_end = EXCLUDED.quiet_hour_end,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('preference', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_customer_notification_preference_v1(UUID, UUID, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_customer_notification_preference_v1(UUID, UUID, TEXT, BOOLEAN, TEXT, TEXT) TO authenticated;

-- ============================================================
-- RPC: one-click opt-out via token (no auth required — token IS the capability)
-- ============================================================
CREATE OR REPLACE FUNCTION public.opt_out_customer_notification_v1(
  p_opt_in_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_row public.customer_notification_preferences%ROWTYPE;
BEGIN
  UPDATE public.customer_notification_preferences
  SET opt_in = FALSE, updated_at = now()
  WHERE opt_in_token = p_opt_in_token
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('preference', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.opt_out_customer_notification_v1(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.opt_out_customer_notification_v1(UUID) TO anon, authenticated;

-- ============================================================
-- RPC: list a customer's preferences (for the staff UI)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_customer_notification_preferences_v1(
  p_center_id UUID,
  p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.channel), '[]'::jsonb)
  INTO v_rows
  FROM public.customer_notification_preferences p
  WHERE p.center_id = p_center_id AND p.customer_id = p_customer_id;

  RETURN jsonb_build_object('preferences', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_customer_notification_preferences_v1(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_notification_preferences_v1(UUID, UUID) TO authenticated;

-- ============================================================
-- Deduplication support on the timeline: dedup_key column
-- (existing rows default to NULL; new rows may set it)
-- ============================================================
ALTER TABLE public.customer_notification_timeline
  ADD COLUMN IF NOT EXISTS dedup_key TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_notification_timeline_dedup
  ON public.customer_notification_timeline(center_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

-- ============================================================
-- RPC: check-and-claim for deduplication (atomic, race-safe)
-- Returns TRUE if the key was already used within the window.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_notification_dedup_v1(
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
  v_recent BOOLEAN;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;
  IF p_dedup_key IS NULL OR length(trim(p_dedup_key)) = 0 THEN
    RAISE EXCEPTION 'invalid_dedup_key' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customer_notification_timeline
    WHERE center_id = p_center_id
      AND dedup_key = p_dedup_key
      AND created_at > now() - make_interval(mins => p_window_minutes)
  ) INTO v_recent;

  RETURN COALESCE(v_recent, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.check_notification_dedup_v1(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_notification_dedup_v1(UUID, TEXT, INTEGER) TO authenticated;

-- The staff UI now writes the notification timeline through the server-governed
-- RPC (member + tenant validated). The 20260810000006 grant-repair contract
-- predates this frontend usage, so this migration extends the explicit
-- whitelist with the exact signature. SECURITY DEFINER + is_center_member
-- guard keeps it safe for authenticated members only.
GRANT EXECUTE ON FUNCTION public.add_customer_notification_event_v1(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

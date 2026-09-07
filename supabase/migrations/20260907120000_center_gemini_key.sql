-- Admin-only Gemini API key for the in-app assistant.
-- Direct table access is revoked; reads and writes go through ADMIN RPCs.

BEGIN;

CREATE TABLE IF NOT EXISTS public.center_gemini_settings (
  center_id UUID PRIMARY KEY REFERENCES public.centers (id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.center_gemini_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS center_gemini_settings_admin ON public.center_gemini_settings;
CREATE POLICY center_gemini_settings_admin ON public.center_gemini_settings
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

REVOKE ALL ON TABLE public.center_gemini_settings FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_center_gemini_key_v1(
  p_center_id UUID,
  p_api_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;

  v_key := btrim(COALESCE(p_api_key, ''));
  IF v_key = '' THEN
    DELETE FROM public.center_gemini_settings WHERE center_id = p_center_id;
    RETURN jsonb_build_object('saved', FALSE);
  END IF;

  INSERT INTO public.center_gemini_settings (center_id, api_key, updated_at, updated_by)
  VALUES (p_center_id, v_key, now(), auth.uid())
  ON CONFLICT (center_id) DO UPDATE
    SET api_key = EXCLUDED.api_key,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;

  RETURN jsonb_build_object('saved', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_center_gemini_key_v1(
  p_center_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT api_key INTO v_key
  FROM public.center_gemini_settings
  WHERE center_id = p_center_id;

  RETURN jsonb_build_object('api_key', COALESCE(v_key, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.save_center_gemini_key_v1(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_center_gemini_key_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_center_gemini_key_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_center_gemini_key_v1(UUID) TO authenticated;

COMMIT;

-- ============================================================
-- LenaBeauty — Client Portal brute-force protection (Phase 0)
-- ------------------------------------------------------------
-- Prior state (20260628000011_client_portal.sql):
--   public_client_portal_login_v1 used a 12-char portal token with
--   NO rate limiting / lockout. An attacker could hammer the anon
--   RPC indefinitely. This migration adds per-customer failed-login
--   tracking + a temporary lockout window, and rewrites the login
--   RPC to enforce it. No existing migration file is modified; this
--   is a standalone, additive migration.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste & run
--             (run AFTER 20260628000011_client_portal.sql).
-- ============================================================

-- 1. Track failed attempts + lockout timestamp on customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_portal_locked_until
  ON public.customers (center_id, portal_locked_until)
  WHERE portal_locked_until IS NOT NULL;

-- 2. Lockout-aware replacement of the login RPC.
--    Signature is unchanged so the frontend call site is unaffected.
CREATE OR REPLACE FUNCTION public.public_client_portal_login_v1(
  p_center_id UUID,
  p_phone TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer   public.customers%ROWTYPE;
  v_max_attempts CONSTANT INTEGER := 5;     -- lock after this many failures
  v_lock_minutes CONSTANT INTEGER := 15;    -- lock duration
  v_phone TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_token TEXT := NULLIF(btrim(COALESCE(p_token, '')), '');
BEGIN
  IF p_center_id IS NULL THEN
    RAISE EXCEPTION 'Missing center id' USING ERRCODE = '22023';
  END IF;

  -- Exact phone + token match. SECURITY DEFINER bypasses RLS so the
  -- lookup works for the anon role that calls this RPC.
  SELECT * INTO v_customer
  FROM public.customers
  WHERE center_id = p_center_id
    AND phone = v_phone
    AND portal_access_token = v_token
    AND portal_access_enabled = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    -- Count the failure against the matching phone. We deliberately do
    -- NOT reveal whether the token itself was wrong (avoids an oracle
    -- for valid phone numbers / tokens). Lock once the threshold is hit.
    UPDATE public.customers
    SET portal_failed_login_attempts = portal_failed_login_attempts + 1,
        portal_locked_until = CASE
          WHEN portal_failed_login_attempts + 1 >= v_max_attempts
          THEN now() + (v_lock_minutes || ' minutes')::INTERVAL
          ELSE portal_locked_until
        END
    WHERE center_id = p_center_id
      AND phone = v_phone
      AND portal_access_enabled = TRUE;

    RAISE EXCEPTION 'Invalid portal credentials' USING ERRCODE = '22023';
  END IF;

  -- Exact match found, but the account is temporarily locked out.
  IF v_customer.portal_locked_until IS NOT NULL AND v_customer.portal_locked_until > now() THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.' USING ERRCODE = '42900';
  END IF;

  -- Success: record the login and clear attempt counters / lock.
  UPDATE public.customers
  SET portal_last_login_at = now(),
      portal_failed_login_attempts = 0,
      portal_locked_until = NULL,
      updated_at = now()
  WHERE id = v_customer.id;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone,
      'loyalty_points', v_customer.loyalty_points,
      'total_spent', v_customer.total_spent,
      'last_visit', v_customer.last_visit,
      'portal_last_login_at', now()
    )
  );
END;
$$;

-- 3. Rotating the portal token grants a fresh credential and clears any
--    existing lockout / failed-attempt counters for a clean slate.
CREATE OR REPLACE FUNCTION public.rotate_customer_portal_token_v1(
  p_center_id UUID,
  p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_token TEXT;
  v_customer public.customers%ROWTYPE;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'Unauthorized client portal center' USING ERRCODE = '42501';
  END IF;

  v_token := substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);

  UPDATE public.customers
  SET portal_access_token = v_token,
      portal_failed_login_attempts = 0,
      portal_locked_until = NULL,
      updated_at = now()
  WHERE id = p_customer_id
    AND center_id = p_center_id
  RETURNING * INTO v_customer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer is not available for this center' USING ERRCODE = '23503';
  END IF;

  RETURN jsonb_build_object(
    'customer_id', v_customer.id,
    'portal_access_token', v_customer.portal_access_token
  );
END;
$$;

-- 4. Re-assert grants (CREATE OR REPLACE preserves privileges, but be explicit).
REVOKE ALL ON FUNCTION public.public_client_portal_login_v1(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_client_portal_login_v1(UUID, TEXT, TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_customer_portal_token_v1(UUID, UUID) TO authenticated;

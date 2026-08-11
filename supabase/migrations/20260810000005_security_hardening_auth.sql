-- =============================================================================
-- LenaBeauty — Production readiness: security hardening + auth protection
-- =============================================================================
-- Phase "Production Readiness & Security Hardening" (2026-08-10).
--
-- Additive, production-safe migration. It only changes security metadata
-- (privileges, policies, function attributes) and function bodies whose
-- signatures stay identical. It does not touch business rows.
--
-- What this migration does:
--   1. Fixes mutable/weak search_path on EVERY app-owned routine (sql + plpgsql)
--      so name resolution can never be role-controlled.
--   2. Removes default PUBLIC/anon EXECUTE and re-grants EXECUTE ONLY to the
--      routines the shipped staff UI actually calls (least privilege).
--      The public booking / client-portal RPCs are kept defined but UNGRANTED:
--      the landing/booking page is intentionally not part of this release, so
--      no role may execute them until that phase re-grants them explicitly.
--   3. Scopes the `center-assets` storage bucket policies to the object's
--      center path segment + center membership (fixes cross-tenant object
--      access by any authenticated user).
--   4. Hardens customer-experience write RPCs to reject caller-supplied
--      references to customers/appointments/services of another center.
--   5. Removes the portal token / lockout counters from the client-portal
--      profile projection (least disclosure).
--   6. Removes DELETE capability on center_settings (members may not delete
--      their own branding/settings row).
--   7. Revokes all table-level privileges from `anon` (no anonymous surface in
--      this release; all future anonymous flows use SECURITY DEFINER RPCs).
--   8. Enables safe Supabase Auth protections via auth.config when the
--      managed platform exposes the columns (guarded, never fails the chain).
--      `password_min_length` is deliberately left unchanged — existing demo /
--      staging credentials must keep signing in; raising it could lock out the
--      demo admin (documented in the phase report).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Immutable search_path for every application-owned routine
-- -----------------------------------------------------------------------------
-- Covers routines created after the previous sweep (20260809000001) and SQL-
-- language helpers that were not swept before. Explicit and immutable: no
-- caller-controlled search_path can hijack unqualified names inside a
-- SECURITY DEFINER body.
DO $$
DECLARE
  routine REGPROCEDURE;
BEGIN
  FOR routine IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.prolang IN (
        (SELECT oid FROM pg_language WHERE lanname = 'plpgsql'),
        (SELECT oid FROM pg_language WHERE lanname = 'sql')
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, public, app_private', routine);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Least-privilege routine grants
-- -----------------------------------------------------------------------------
-- Remove the default PUBLIC EXECUTE. From here on, execution is explicit.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public      FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;

-- Whitelist: routines the shipped staff UI executes (see repositories.ts).
-- Only these are executable by `authenticated`; everything else (including
-- every public-booking and client-portal RPC) has zero grants.
DO $$
DECLARE
  routine REGPROCEDURE;
BEGIN
  FOR routine IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'process_checkout_v1',
        'upsert_notification_settings_v1',
        'upsert_payment_gateway_settings_v1',
        'mark_appointment_no_show_v1',
        'issue_gift_card_v1',
        'create_service_package_v1',
        'rotate_customer_portal_token_v1',
        'create_customer_review_v1',
        'create_service_file_v1',
        'add_customer_notification_event_v1',
        'create_accounting_journal_entry_v1',
        'create_ai_booking_lead_v1'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', routine);
  END LOOP;
END
$$;

-- RLS helper routines must stay executable by any role so that policy
-- expressions can be evaluated (anon callers get an empty membership set).
GRANT EXECUTE ON FUNCTION app_private.user_center_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_center_member(UUID) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage: center-scoped object access
-- -----------------------------------------------------------------------------
-- Objects live at `{center_id}/...` (Settings.uploadLogo uses
-- `${centerId}/logo-...`). Previously ANY authenticated user could read or
-- write ANY object in the bucket (cross-tenant leak). Policies below require
-- the first path segment to be a UUID the caller is a member of.
CREATE OR REPLACE FUNCTION app_private.storage_path_center_id(p_path TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN split_part(p_path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_path, '/', 1)::uuid
    ELSE NULL
  END;
$$;

-- The helper is created fresh, so remove the default PUBLIC EXECUTE and grant
-- only the roles that need it for policy evaluation (least privilege).
REVOKE ALL ON FUNCTION app_private.storage_path_center_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.storage_path_center_id(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS center_assets_read   ON storage.objects;
DROP POLICY IF EXISTS center_assets_write  ON storage.objects;
DROP POLICY IF EXISTS center_assets_update ON storage.objects;

DROP POLICY IF EXISTS center_assets_member_select ON storage.objects;
DROP POLICY IF EXISTS center_assets_member_insert ON storage.objects;
DROP POLICY IF EXISTS center_assets_member_update ON storage.objects;

CREATE POLICY center_assets_member_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.is_center_member(app_private.storage_path_center_id(name))
  );

CREATE POLICY center_assets_member_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.is_center_member(app_private.storage_path_center_id(name))
  );

CREATE POLICY center_assets_member_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.is_center_member(app_private.storage_path_center_id(name))
  )
  WITH CHECK (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.is_center_member(app_private.storage_path_center_id(name))
  );

-- -----------------------------------------------------------------------------
-- 4. Cross-center entity verification in customer-experience write RPCs
-- -----------------------------------------------------------------------------
-- These RPCs previously only verified membership of p_center_id, so a member
-- of center A could create rows in center A that referenced a customer /
-- appointment / service of center B (cross-tenant reference injection).
-- Signatures are unchanged; only server-side entity scoping is added.

CREATE OR REPLACE FUNCTION public.create_customer_review_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_appointment_id UUID,
  p_rating SMALLINT,
  p_comment TEXT,
  p_is_published BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_review public.customer_reviews;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = p_customer_id AND c.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_in_center' USING ERRCODE = '23503';
  END IF;

  IF p_appointment_id IS NOT NULL THEN
    PERFORM 1 FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.center_id = p_center_id
      AND a.customer_id = p_customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'appointment_not_in_center' USING ERRCODE = '23503';
    END IF;
  END IF;

  INSERT INTO public.customer_reviews (
    center_id, customer_id, appointment_id, rating, comment, is_published
  ) VALUES (
    p_center_id, p_customer_id, p_appointment_id, p_rating, NULLIF(trim(COALESCE(p_comment, '')), ''), COALESCE(p_is_published, FALSE)
  )
  RETURNING * INTO v_review;

  RETURN jsonb_build_object('review', to_jsonb(v_review));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_service_file_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_appointment_id UUID,
  p_service_id UUID,
  p_title TEXT,
  p_note TEXT,
  p_before_images TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_after_images TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_reference_images TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_file public.service_files;
  v_image TEXT;
  v_index INTEGER := 0;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = p_customer_id AND c.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_in_center' USING ERRCODE = '23503';
  END IF;

  IF p_appointment_id IS NOT NULL THEN
    PERFORM 1 FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.center_id = p_center_id
      AND a.customer_id = p_customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'appointment_not_in_center' USING ERRCODE = '23503';
    END IF;
  END IF;

  IF p_service_id IS NOT NULL THEN
    PERFORM 1 FROM public.services s
    WHERE s.id = p_service_id AND s.center_id = p_center_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'service_not_in_center' USING ERRCODE = '23503';
    END IF;
  END IF;

  INSERT INTO public.service_files (
    center_id, customer_id, appointment_id, service_id, title, note, created_by
  ) VALUES (
    p_center_id, p_customer_id, p_appointment_id, p_service_id,
    COALESCE(NULLIF(trim(p_title), ''), 'Service File'),
    NULLIF(trim(COALESCE(p_note, '')), ''),
    auth.uid()
  ) RETURNING * INTO v_file;

  v_index := 0;
  FOREACH v_image IN ARRAY COALESCE(p_before_images, ARRAY[]::TEXT[]) LOOP
    INSERT INTO public.service_file_images (center_id, service_file_id, image_kind, image_url, sort_order)
    VALUES (p_center_id, v_file.id, 'BEFORE', v_image, v_index);
    v_index := v_index + 1;
  END LOOP;

  v_index := 0;
  FOREACH v_image IN ARRAY COALESCE(p_after_images, ARRAY[]::TEXT[]) LOOP
    INSERT INTO public.service_file_images (center_id, service_file_id, image_kind, image_url, sort_order)
    VALUES (p_center_id, v_file.id, 'AFTER', v_image, v_index);
    v_index := v_index + 1;
  END LOOP;

  v_index := 0;
  FOREACH v_image IN ARRAY COALESCE(p_reference_images, ARRAY[]::TEXT[]) LOOP
    INSERT INTO public.service_file_images (center_id, service_file_id, image_kind, image_url, sort_order)
    VALUES (p_center_id, v_file.id, 'REFERENCE', v_image, v_index);
    v_index := v_index + 1;
  END LOOP;

  RETURN jsonb_build_object('service_file', to_jsonb(v_file));
END;
$$;

CREATE OR REPLACE FUNCTION public.add_customer_notification_event_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_appointment_id UUID,
  p_channel TEXT,
  p_direction TEXT,
  p_template_key TEXT,
  p_message_preview TEXT,
  p_delivery_status TEXT,
  p_sent_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_event public.customer_notification_timeline;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = p_customer_id AND c.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_in_center' USING ERRCODE = '23503';
  END IF;

  IF p_appointment_id IS NOT NULL THEN
    PERFORM 1 FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND a.center_id = p_center_id
      AND a.customer_id = p_customer_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'appointment_not_in_center' USING ERRCODE = '23503';
    END IF;
  END IF;

  INSERT INTO public.customer_notification_timeline (
    center_id, customer_id, appointment_id, channel, direction, template_key, message_preview, delivery_status, sent_at
  ) VALUES (
    p_center_id, p_customer_id, p_appointment_id,
    UPPER(COALESCE(p_channel, 'SYSTEM')),
    UPPER(COALESCE(p_direction, 'OUTBOUND')),
    NULLIF(trim(COALESCE(p_template_key, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_message_preview, '')), ''), 'Message event'),
    UPPER(COALESCE(p_delivery_status, 'QUEUED')),
    p_sent_at
  ) RETURNING * INTO v_event;

  RETURN jsonb_build_object('event', to_jsonb(v_event));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accounting_journal_entry_v1(
  p_center_id UUID,
  p_entry_date DATE,
  p_entry_type TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_description TEXT,
  p_debit_account TEXT,
  p_credit_account TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'OMR'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_entry public.accounting_journal_entries;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  -- p_reference_id is an informational reference (no FK, no table identity),
  -- so it cannot be validated against a center; it is never used to join or
  -- expose another center's data. All rows are stamped with the caller's
  -- center_id and created_by.

  INSERT INTO public.accounting_journal_entries (
    center_id, entry_date, entry_type, reference_type, reference_id,
    description, debit_account, credit_account, amount, currency, created_by
  ) VALUES (
    p_center_id,
    COALESCE(p_entry_date, CURRENT_DATE),
    UPPER(COALESCE(p_entry_type, 'ADJUSTMENT')),
    NULLIF(trim(COALESCE(p_reference_type, '')), ''),
    p_reference_id,
    COALESCE(NULLIF(trim(COALESCE(p_description, '')), ''), 'Journal Entry'),
    COALESCE(NULLIF(trim(COALESCE(p_debit_account, '')), ''), 'Uncategorized Debit'),
    COALESCE(NULLIF(trim(COALESCE(p_credit_account, '')), ''), 'Uncategorized Credit'),
    GREATEST(COALESCE(p_amount, 0), 0),
    COALESCE(NULLIF(trim(COALESCE(p_currency, '')), ''), 'OMR'),
    auth.uid()
  ) RETURNING * INTO v_entry;

  RETURN jsonb_build_object('entry', to_jsonb(v_entry));
END;
$$;

CREATE OR REPLACE FUNCTION public.create_ai_booking_lead_v1(
  p_center_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_preferred_service_id UUID,
  p_preferred_date TIMESTAMPTZ,
  p_source_channel TEXT,
  p_summary TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_lead public.ai_booking_leads;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_preferred_service_id IS NOT NULL THEN
    PERFORM 1 FROM public.services s
    WHERE s.id = p_preferred_service_id AND s.center_id = p_center_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'service_not_in_center' USING ERRCODE = '23503';
    END IF;
  END IF;

  INSERT INTO public.ai_booking_leads (
    center_id, customer_name, customer_phone, preferred_service_id, preferred_date, source_channel, summary
  ) VALUES (
    p_center_id,
    COALESCE(NULLIF(trim(COALESCE(p_customer_name, '')), ''), 'Guest lead'),
    NULLIF(trim(COALESCE(p_customer_phone, '')), ''),
    p_preferred_service_id,
    p_preferred_date,
    UPPER(COALESCE(p_source_channel, 'WEB')),
    NULLIF(trim(COALESCE(p_summary, '')), '')
  ) RETURNING * INTO v_lead;

  RETURN jsonb_build_object('lead', to_jsonb(v_lead));
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Client-portal profile: least disclosure
-- -----------------------------------------------------------------------------
-- The old projection returned the whole customers row, including
-- portal_access_token and the lockout counters. The caller already presented
-- the token, but the credential and counters should never be echoed back in a
-- profile payload.
CREATE OR REPLACE FUNCTION public.public_client_portal_profile_v2(
  p_center_id UUID,
  p_customer_id UUID,
  p_phone TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_customer public.customers;
BEGIN
  SELECT *
  INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
    AND center_id = p_center_id
    AND COALESCE(phone, '') = COALESCE(p_phone, '')
    AND portal_access_enabled = TRUE
    AND portal_access_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_portal_credentials';
  END IF;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'name', v_customer.name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'notes', v_customer.notes,
      'loyalty_points', v_customer.loyalty_points,
      'total_spent', v_customer.total_spent,
      'last_visit', v_customer.last_visit,
      'portal_last_login_at', v_customer.portal_last_login_at,
      'portal_access_enabled', v_customer.portal_access_enabled
    ),
    'appointments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'date_time', a.date_time,
        'status', a.status,
        'notes', a.notes,
        'deposit_amount', COALESCE(a.deposit_amount, 0),
        'no_show_fee_amount', COALESCE(a.no_show_fee_amount, 0),
        'no_show_fee_charged', COALESCE(a.no_show_fee_charged, 0),
        'employee_name', e.name,
        'service_name', s.name
      ) ORDER BY a.date_time DESC)
      FROM public.appointments a
      LEFT JOIN public.employees e ON e.id = a.employee_id
      LEFT JOIN public.services s ON s.id = a.service_id
      WHERE a.center_id = p_center_id AND a.customer_id = p_customer_id
    ), '[]'::jsonb),
    'invoices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'serial_number', i.serial_number,
        'date', i.date,
        'total_amount', i.total_amount,
        'discount', i.discount,
        'tax', COALESCE(i.tax, 0),
        'payment_method', i.payment_method
      ) ORDER BY i.date DESC)
      FROM public.invoices i
      WHERE i.center_id = p_center_id AND i.customer_id = p_customer_id
    ), '[]'::jsonb),
    'reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'appointment_id', r.appointment_id,
        'rating', r.rating,
        'comment', r.comment,
        'is_published', r.is_published,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.customer_reviews r
      WHERE r.center_id = p_center_id AND r.customer_id = p_customer_id
    ), '[]'::jsonb),
    'service_files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sf.id,
        'appointment_id', sf.appointment_id,
        'service_id', sf.service_id,
        'title', sf.title,
        'note', sf.note,
        'created_at', sf.created_at,
        'images', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', sfi.id,
            'image_kind', sfi.image_kind,
            'image_url', sfi.image_url,
            'sort_order', sfi.sort_order,
            'created_at', sfi.created_at
          ) ORDER BY sfi.image_kind, sfi.sort_order, sfi.created_at)
          FROM public.service_file_images sfi
          WHERE sfi.service_file_id = sf.id
        ), '[]'::jsonb)
      ) ORDER BY sf.created_at DESC)
      FROM public.service_files sf
      WHERE sf.center_id = p_center_id AND sf.customer_id = p_customer_id
    ), '[]'::jsonb),
    'notification_timeline', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', nt.id,
        'appointment_id', nt.appointment_id,
        'channel', nt.channel,
        'direction', nt.direction,
        'template_key', nt.template_key,
        'message_preview', nt.message_preview,
        'delivery_status', nt.delivery_status,
        'sent_at', nt.sent_at,
        'created_at', nt.created_at
      ) ORDER BY nt.created_at DESC)
      FROM public.customer_notification_timeline nt
      WHERE nt.center_id = p_center_id AND nt.customer_id = p_customer_id
    ), '[]'::jsonb),
    'referral', jsonb_build_object(
      'code', v_customer.referral_code,
      'points_earned', COALESCE(v_customer.referral_points_earned, 0)
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. center_settings: no member DELETE
-- -----------------------------------------------------------------------------
-- Settings/branding rows are single rows per center and must never be
-- deletable from the client. SELECT/INSERT/UPDATE remain member-scoped.
DROP POLICY IF EXISTS center_settings_select ON public.center_settings;
DROP POLICY IF EXISTS center_settings_write   ON public.center_settings;

CREATE POLICY center_settings_select ON public.center_settings
  FOR SELECT TO authenticated
  USING (center_id = ANY (app_private.user_center_ids()));

CREATE POLICY center_settings_insert ON public.center_settings
  FOR INSERT TO authenticated
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

CREATE POLICY center_settings_update ON public.center_settings
  FOR UPDATE TO authenticated
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

-- -----------------------------------------------------------------------------
-- 7. Remove anonymous table-level privileges
-- -----------------------------------------------------------------------------
-- This release has no anonymous surface: every public flow is routed through
-- SECURITY DEFINER RPCs (which run with the definer's privileges), so anon
-- needs no direct table access. Revoking it is defense in depth.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- -----------------------------------------------------------------------------
-- 8. Supabase Auth protections (guarded — never breaks the migration chain)
-- -----------------------------------------------------------------------------
-- Managed Supabase stores these dashboard settings in auth.config. Column
-- availability varies by platform version, so each change is guarded. Where a
-- column is absent, a NOTICE documents that the dashboard toggle must be set
-- manually. password_min_length is intentionally NOT changed here: existing
-- demo/staging passwords must keep signing in (raising the minimum can turn
-- sign-in into WeakPasswordError for short legacy passwords).
DO $$
DECLARE
  v_has_config   BOOLEAN;
  v_has_hibp     BOOLEAN;
  v_has_reauth   BOOLEAN;
BEGIN
  v_has_config := to_regclass('auth.config') IS NOT NULL;

  IF NOT v_has_config THEN
    RAISE NOTICE 'auth.config is not present; enable leaked-password protection in the Supabase dashboard (Authentication -> Providers -> Email -> Password security).';
  ELSE
    v_has_hibp := EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'config' AND column_name = 'password_hibp_enabled'
    );
    IF v_has_hibp THEN
      EXECUTE 'UPDATE auth.config SET password_hibp_enabled = true';
      RAISE NOTICE 'auth.config.password_hibp_enabled set to true (leaked password protection).';
    ELSE
      RAISE NOTICE 'auth.config.password_hibp_enabled column not found; enable leaked-password protection in the Supabase dashboard.';
    END IF;

    v_has_reauth := EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'config' AND column_name = 'security_update_password_require_reauthentication'
    );
    IF v_has_reauth THEN
      EXECUTE 'UPDATE auth.config SET security_update_password_require_reauthentication = true';
      RAISE NOTICE 'auth.config.security_update_password_require_reauthentication set to true.';
    ELSE
      RAISE NOTICE 'auth.config.security_update_password_require_reauthentication column not found; set "Require reauthentication when changing password" in the dashboard.';
    END IF;
  END IF;

  RAISE NOTICE 'auth password_min_length intentionally unchanged (existing demo/staging credentials must remain sign-in compatible).';
END
$$;

COMMIT;

-- ============================================================
-- LenaBeauty — Notifications + payment gateway settings
-- Adds persisted settings for WhatsApp/SMS reminders and online deposits.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL UNIQUE REFERENCES public.centers(id) ON DELETE CASCADE,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_hours_before INTEGER NOT NULL DEFAULT 24,
  whatsapp_sender_name TEXT,
  sms_sender_name TEXT,
  whatsapp_template_booking TEXT,
  whatsapp_template_reminder TEXT,
  sms_template_reminder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_settings_reminder_hours_check CHECK (reminder_hours_before BETWEEN 1 AND 168)
);

CREATE TABLE IF NOT EXISTS public.payment_gateway_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL UNIQUE REFERENCES public.centers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_sandbox BOOLEAN NOT NULL DEFAULT TRUE,
  public_key TEXT,
  merchant_identifier TEXT,
  webhook_secret_hint TEXT,
  booking_deposit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  booking_deposit_type TEXT NOT NULL DEFAULT 'fixed',
  booking_deposit_value NUMERIC(12,3) NOT NULL DEFAULT 0,
  success_url TEXT,
  cancel_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_gateway_provider_check CHECK (provider IN ('manual', 'thawani', 'paytabs', 'stripe')),
  CONSTRAINT payment_gateway_deposit_type_check CHECK (booking_deposit_type IN ('fixed', 'percentage')),
  CONSTRAINT payment_gateway_deposit_value_check CHECK (booking_deposit_value >= 0)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_settings_select_member ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_insert_member ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_update_member ON public.notification_settings;
DROP POLICY IF EXISTS payment_gateway_settings_select_member ON public.payment_gateway_settings;
DROP POLICY IF EXISTS payment_gateway_settings_insert_member ON public.payment_gateway_settings;
DROP POLICY IF EXISTS payment_gateway_settings_update_member ON public.payment_gateway_settings;

CREATE POLICY notification_settings_select_member
ON public.notification_settings
FOR SELECT
TO authenticated
USING (app_private.is_center_member(center_id));

CREATE POLICY notification_settings_insert_member
ON public.notification_settings
FOR INSERT
TO authenticated
WITH CHECK (app_private.is_center_member(center_id));

CREATE POLICY notification_settings_update_member
ON public.notification_settings
FOR UPDATE
TO authenticated
USING (app_private.is_center_member(center_id))
WITH CHECK (app_private.is_center_member(center_id));

CREATE POLICY payment_gateway_settings_select_member
ON public.payment_gateway_settings
FOR SELECT
TO authenticated
USING (app_private.is_center_member(center_id));

CREATE POLICY payment_gateway_settings_insert_member
ON public.payment_gateway_settings
FOR INSERT
TO authenticated
WITH CHECK (app_private.is_center_member(center_id));

CREATE POLICY payment_gateway_settings_update_member
ON public.payment_gateway_settings
FOR UPDATE
TO authenticated
USING (app_private.is_center_member(center_id))
WITH CHECK (app_private.is_center_member(center_id));

CREATE OR REPLACE FUNCTION app_private.set_notification_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER set_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW
EXECUTE FUNCTION app_private.set_notification_settings_updated_at();

CREATE OR REPLACE FUNCTION app_private.set_payment_gateway_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_payment_gateway_settings_updated_at ON public.payment_gateway_settings;
CREATE TRIGGER set_payment_gateway_settings_updated_at
BEFORE UPDATE ON public.payment_gateway_settings
FOR EACH ROW
EXECUTE FUNCTION app_private.set_payment_gateway_settings_updated_at();

INSERT INTO public.notification_settings (center_id)
SELECT c.id
FROM public.centers c
WHERE NOT EXISTS (
  SELECT 1 FROM public.notification_settings ns WHERE ns.center_id = c.id
);

INSERT INTO public.payment_gateway_settings (center_id)
SELECT c.id
FROM public.centers c
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_gateway_settings pgs WHERE pgs.center_id = c.id
);

CREATE OR REPLACE FUNCTION public.upsert_notification_settings_v1(
  p_center_id UUID,
  p_whatsapp_enabled BOOLEAN,
  p_sms_enabled BOOLEAN,
  p_reminder_enabled BOOLEAN,
  p_reminder_hours_before INTEGER,
  p_whatsapp_sender_name TEXT,
  p_sms_sender_name TEXT,
  p_whatsapp_template_booking TEXT,
  p_whatsapp_template_reminder TEXT,
  p_sms_template_reminder TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_row public.notification_settings%ROWTYPE;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'Unauthorized notification center' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notification_settings (
    center_id,
    whatsapp_enabled,
    sms_enabled,
    reminder_enabled,
    reminder_hours_before,
    whatsapp_sender_name,
    sms_sender_name,
    whatsapp_template_booking,
    whatsapp_template_reminder,
    sms_template_reminder
  )
  VALUES (
    p_center_id,
    COALESCE(p_whatsapp_enabled, FALSE),
    COALESCE(p_sms_enabled, FALSE),
    COALESCE(p_reminder_enabled, TRUE),
    COALESCE(p_reminder_hours_before, 24),
    NULLIF(trim(p_whatsapp_sender_name), ''),
    NULLIF(trim(p_sms_sender_name), ''),
    NULLIF(trim(p_whatsapp_template_booking), ''),
    NULLIF(trim(p_whatsapp_template_reminder), ''),
    NULLIF(trim(p_sms_template_reminder), '')
  )
  ON CONFLICT (center_id)
  DO UPDATE SET
    whatsapp_enabled = EXCLUDED.whatsapp_enabled,
    sms_enabled = EXCLUDED.sms_enabled,
    reminder_enabled = EXCLUDED.reminder_enabled,
    reminder_hours_before = EXCLUDED.reminder_hours_before,
    whatsapp_sender_name = EXCLUDED.whatsapp_sender_name,
    sms_sender_name = EXCLUDED.sms_sender_name,
    whatsapp_template_booking = EXCLUDED.whatsapp_template_booking,
    whatsapp_template_reminder = EXCLUDED.whatsapp_template_reminder,
    sms_template_reminder = EXCLUDED.sms_template_reminder,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('notification_settings', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_payment_gateway_settings_v1(
  p_center_id UUID,
  p_provider TEXT,
  p_is_enabled BOOLEAN,
  p_is_sandbox BOOLEAN,
  p_public_key TEXT,
  p_merchant_identifier TEXT,
  p_webhook_secret_hint TEXT,
  p_booking_deposit_enabled BOOLEAN,
  p_booking_deposit_type TEXT,
  p_booking_deposit_value NUMERIC,
  p_success_url TEXT,
  p_cancel_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_row public.payment_gateway_settings%ROWTYPE;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'Unauthorized payment gateway center' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.payment_gateway_settings (
    center_id,
    provider,
    is_enabled,
    is_sandbox,
    public_key,
    merchant_identifier,
    webhook_secret_hint,
    booking_deposit_enabled,
    booking_deposit_type,
    booking_deposit_value,
    success_url,
    cancel_url
  )
  VALUES (
    p_center_id,
    COALESCE(NULLIF(trim(p_provider), ''), 'manual'),
    COALESCE(p_is_enabled, FALSE),
    COALESCE(p_is_sandbox, TRUE),
    NULLIF(trim(p_public_key), ''),
    NULLIF(trim(p_merchant_identifier), ''),
    NULLIF(trim(p_webhook_secret_hint), ''),
    COALESCE(p_booking_deposit_enabled, FALSE),
    COALESCE(NULLIF(trim(p_booking_deposit_type), ''), 'fixed'),
    GREATEST(COALESCE(p_booking_deposit_value, 0), 0),
    NULLIF(trim(p_success_url), ''),
    NULLIF(trim(p_cancel_url), '')
  )
  ON CONFLICT (center_id)
  DO UPDATE SET
    provider = EXCLUDED.provider,
    is_enabled = EXCLUDED.is_enabled,
    is_sandbox = EXCLUDED.is_sandbox,
    public_key = EXCLUDED.public_key,
    merchant_identifier = EXCLUDED.merchant_identifier,
    webhook_secret_hint = EXCLUDED.webhook_secret_hint,
    booking_deposit_enabled = EXCLUDED.booking_deposit_enabled,
    booking_deposit_type = EXCLUDED.booking_deposit_type,
    booking_deposit_value = EXCLUDED.booking_deposit_value,
    success_url = EXCLUDED.success_url,
    cancel_url = EXCLUDED.cancel_url,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('payment_gateway_settings', to_jsonb(v_row));
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_notification_settings_v1(UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_notification_settings_v1(UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_payment_gateway_settings_v1(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_payment_gateway_settings_v1(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;

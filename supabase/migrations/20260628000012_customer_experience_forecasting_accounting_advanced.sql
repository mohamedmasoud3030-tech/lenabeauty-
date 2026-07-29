BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_points_earned INTEGER NOT NULL DEFAULT 0;

UPDATE public.customers
SET referral_code = COALESCE(referral_code, UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 8)))
WHERE referral_code IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_center_referral_code
  ON public.customers(center_id, referral_code);

CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_reviews_one_per_appointment
  ON public.customer_reviews(appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_reviews_center_customer
  ON public.customer_reviews(center_id, customer_id, created_at DESC);

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_reviews_select_policy ON public.customer_reviews
  FOR SELECT USING (app_private.is_center_member(center_id));
CREATE POLICY customer_reviews_insert_policy ON public.customer_reviews
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY customer_reviews_update_policy ON public.customer_reviews
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY customer_reviews_delete_policy ON public.customer_reviews
  FOR DELETE USING (app_private.is_center_member(center_id));

CREATE TABLE IF NOT EXISTS public.service_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_files_center_customer
  ON public.service_files(center_id, customer_id, created_at DESC);

ALTER TABLE public.service_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_files_select_policy ON public.service_files
  FOR SELECT USING (app_private.is_center_member(center_id));
CREATE POLICY service_files_insert_policy ON public.service_files
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY service_files_update_policy ON public.service_files
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY service_files_delete_policy ON public.service_files
  FOR DELETE USING (app_private.is_center_member(center_id));

CREATE TABLE IF NOT EXISTS public.service_file_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  service_file_id UUID NOT NULL REFERENCES public.service_files(id) ON DELETE CASCADE,
  image_kind TEXT NOT NULL CHECK (image_kind IN ('BEFORE', 'AFTER', 'REFERENCE')),
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_file_images_file
  ON public.service_file_images(service_file_id, image_kind, sort_order, created_at);

ALTER TABLE public.service_file_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_file_images_select_policy ON public.service_file_images
  FOR SELECT USING (app_private.is_center_member(center_id));
CREATE POLICY service_file_images_insert_policy ON public.service_file_images
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY service_file_images_update_policy ON public.service_file_images
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY service_file_images_delete_policy ON public.service_file_images
  FOR DELETE USING (app_private.is_center_member(center_id));

CREATE TABLE IF NOT EXISTS public.customer_notification_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'SMS', 'EMAIL', 'SYSTEM')),
  direction TEXT NOT NULL DEFAULT 'OUTBOUND' CHECK (direction IN ('OUTBOUND', 'INBOUND')),
  template_key TEXT,
  message_preview TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notification_timeline_customer
  ON public.customer_notification_timeline(center_id, customer_id, created_at DESC);

ALTER TABLE public.customer_notification_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_notification_timeline_select_policy ON public.customer_notification_timeline
  FOR SELECT USING (app_private.is_center_member(center_id));
CREATE POLICY customer_notification_timeline_insert_policy ON public.customer_notification_timeline
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY customer_notification_timeline_update_policy ON public.customer_notification_timeline
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY customer_notification_timeline_delete_policy ON public.customer_notification_timeline
  FOR DELETE USING (app_private.is_center_member(center_id));

CREATE TABLE IF NOT EXISTS public.accounting_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('SALE', 'EXPENSE', 'PAYROLL', 'ADJUSTMENT', 'TRANSFER')),
  reference_type TEXT,
  reference_id UUID,
  description TEXT NOT NULL,
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'OMR',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_journal_entries_center_date
  ON public.accounting_journal_entries(center_id, entry_date DESC, created_at DESC);

ALTER TABLE public.accounting_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounting_journal_entries_select_policy ON public.accounting_journal_entries
  FOR SELECT USING (app_private.is_center_member(center_id));
CREATE POLICY accounting_journal_entries_insert_policy ON public.accounting_journal_entries
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY accounting_journal_entries_update_policy ON public.accounting_journal_entries
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY accounting_journal_entries_delete_policy ON public.accounting_journal_entries
  FOR DELETE USING (app_private.is_center_member(center_id));

CREATE TABLE IF NOT EXISTS public.ai_booking_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  preferred_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  preferred_date TIMESTAMPTZ,
  source_channel TEXT NOT NULL DEFAULT 'WEB' CHECK (source_channel IN ('WEB', 'WHATSAPP', 'INSTAGRAM', 'PHONE', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'QUALIFIED', 'BOOKED', 'CLOSED')),
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_booking_leads_center_status
  ON public.ai_booking_leads(center_id, status, created_at DESC);

ALTER TABLE public.ai_booking_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_booking_leads_select_policy ON public.ai_booking_leads
  FOR SELECT USING (app_private.is_center_member(center_id));
CREATE POLICY ai_booking_leads_insert_policy ON public.ai_booking_leads
  FOR INSERT WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY ai_booking_leads_update_policy ON public.ai_booking_leads
  FOR UPDATE USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));
CREATE POLICY ai_booking_leads_delete_policy ON public.ai_booking_leads
  FOR DELETE USING (app_private.is_center_member(center_id));

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_reviews_updated_at ON public.customer_reviews;
CREATE TRIGGER trg_customer_reviews_updated_at
BEFORE UPDATE ON public.customer_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_service_files_updated_at ON public.service_files;
CREATE TRIGGER trg_service_files_updated_at
BEFORE UPDATE ON public.service_files
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_accounting_journal_entries_updated_at ON public.accounting_journal_entries;
CREATE TRIGGER trg_accounting_journal_entries_updated_at
BEFORE UPDATE ON public.accounting_journal_entries
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS trg_ai_booking_leads_updated_at ON public.ai_booking_leads;
CREATE TRIGGER trg_ai_booking_leads_updated_at
BEFORE UPDATE ON public.ai_booking_leads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

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
SET search_path = public, app_private
AS $$
DECLARE
  v_review public.customer_reviews;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege';
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
SET search_path = public, app_private
AS $$
DECLARE
  v_file public.service_files;
  v_image TEXT;
  v_index INTEGER := 0;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege';
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
SET search_path = public, app_private
AS $$
DECLARE
  v_event public.customer_notification_timeline;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege';
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
SET search_path = public, app_private
AS $$
DECLARE
  v_entry public.accounting_journal_entries;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

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
SET search_path = public, app_private
AS $$
DECLARE
  v_lead public.ai_booking_leads;
BEGIN
  IF NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'insufficient_privilege';
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

CREATE OR REPLACE FUNCTION public.public_client_portal_profile_v2(
  p_center_id UUID,
  p_customer_id UUID,
  p_phone TEXT,
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'customer', to_jsonb(v_customer),
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

COMMIT;

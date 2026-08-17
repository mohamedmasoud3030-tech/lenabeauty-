-- =============================================================================
-- LenaBeauty — authorization boundary repair
-- =============================================================================
-- Aligns the canonical database boundary with the shipped RequireAdmin routes.
-- Existing business implementations are retained as private, non-executable
-- implementation functions; public signatures become ADMIN-checking wrappers.
-- Also keeps employee identity fields readable to center members while moving
-- compensation reads and every employee write behind governed RPCs.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Preserve the existing, already-tested implementations under private ACLs.
--    The guards make this migration idempotent when the full chain is replayed.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF to_regprocedure('public.upsert_notification_settings_admin_impl_v1(uuid,boolean,boolean,boolean,integer,text,text,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.upsert_notification_settings_v1(UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)
      RENAME TO upsert_notification_settings_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.upsert_payment_gateway_settings_admin_impl_v1(uuid,text,boolean,boolean,text,text,text,boolean,text,numeric,text,text)') IS NULL THEN
    ALTER FUNCTION public.upsert_payment_gateway_settings_v1(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT)
      RENAME TO upsert_payment_gateway_settings_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.create_customer_review_admin_impl_v1(uuid,uuid,uuid,smallint,text,boolean)') IS NULL THEN
    ALTER FUNCTION public.create_customer_review_v1(UUID, UUID, UUID, SMALLINT, TEXT, BOOLEAN)
      RENAME TO create_customer_review_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.create_service_file_admin_impl_v1(uuid,uuid,uuid,uuid,text,text,text[],text[],text[])') IS NULL THEN
    ALTER FUNCTION public.create_service_file_v1(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT[], TEXT[], TEXT[])
      RENAME TO create_service_file_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.create_accounting_journal_entry_admin_impl_v1(uuid,date,text,text,uuid,text,text,text,numeric,text)') IS NULL THEN
    ALTER FUNCTION public.create_accounting_journal_entry_v1(UUID, DATE, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT)
      RENAME TO create_accounting_journal_entry_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.create_ai_booking_lead_admin_impl_v1(uuid,text,text,uuid,timestamp with time zone,text,text)') IS NULL THEN
    ALTER FUNCTION public.create_ai_booking_lead_v1(UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT)
      RENAME TO create_ai_booking_lead_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.refund_entitlement_admin_impl_v1(uuid,numeric,text,uuid)') IS NULL THEN
    ALTER FUNCTION public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID)
      RENAME TO refund_entitlement_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.void_entitlement_admin_impl_v1(uuid,text,uuid)') IS NULL THEN
    ALTER FUNCTION public.void_entitlement_v1(UUID, TEXT, UUID)
      RENAME TO void_entitlement_admin_impl_v1;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.expire_entitlement_admin_impl_v1(uuid,text,uuid)') IS NULL THEN
    ALTER FUNCTION public.expire_entitlement_v1(UUID, TEXT, UUID)
      RENAME TO expire_entitlement_admin_impl_v1;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.upsert_notification_settings_admin_impl_v1(UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_payment_gateway_settings_admin_impl_v1(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_customer_review_admin_impl_v1(UUID, UUID, UUID, SMALLINT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_service_file_admin_impl_v1(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT[], TEXT[], TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_accounting_journal_entry_admin_impl_v1(UUID, DATE, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_ai_booking_lead_admin_impl_v1(UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_entitlement_admin_impl_v1(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.void_entitlement_admin_impl_v1(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_entitlement_admin_impl_v1(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Recreate the public RPC surface with an explicit center ADMIN check.
-- -----------------------------------------------------------------------------
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
SET search_path = pg_catalog, public, app_private
AS $$
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.upsert_notification_settings_admin_impl_v1(
    p_center_id, p_whatsapp_enabled, p_sms_enabled, p_reminder_enabled,
    p_reminder_hours_before, p_whatsapp_sender_name, p_sms_sender_name,
    p_whatsapp_template_booking, p_whatsapp_template_reminder, p_sms_template_reminder
  );
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
SET search_path = pg_catalog, public, app_private
AS $$
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.upsert_payment_gateway_settings_admin_impl_v1(
    p_center_id, p_provider, p_is_enabled, p_is_sandbox, p_public_key,
    p_merchant_identifier, p_webhook_secret_hint, p_booking_deposit_enabled,
    p_booking_deposit_type, p_booking_deposit_value, p_success_url, p_cancel_url
  );
END;
$$;

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
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.create_customer_review_admin_impl_v1(
    p_center_id, p_customer_id, p_appointment_id, p_rating, p_comment, p_is_published
  );
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
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.create_service_file_admin_impl_v1(
    p_center_id, p_customer_id, p_appointment_id, p_service_id, p_title, p_note,
    p_before_images, p_after_images, p_reference_images
  );
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
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.create_accounting_journal_entry_admin_impl_v1(
    p_center_id, p_entry_date, p_entry_type, p_reference_type, p_reference_id,
    p_description, p_debit_account, p_credit_account, p_amount, p_currency
  );
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
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.create_ai_booking_lead_admin_impl_v1(
    p_center_id, p_customer_name, p_customer_phone, p_preferred_service_id,
    p_preferred_date, p_source_channel, p_summary
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_entitlement_v1(
  p_entitlement_id UUID,
  p_amount NUMERIC,
  p_reason TEXT,
  p_actor_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_center_id UUID;
BEGIN
  SELECT center_id INTO v_center_id
  FROM public.customer_entitlements
  WHERE id = p_entitlement_id;
  IF v_center_id IS NULL OR NOT app_private.has_center_role(v_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.refund_entitlement_admin_impl_v1(
    p_entitlement_id, p_amount, p_reason, p_actor_employee_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_entitlement_v1(
  p_entitlement_id UUID,
  p_reason TEXT,
  p_actor_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_center_id UUID;
BEGIN
  SELECT center_id INTO v_center_id
  FROM public.customer_entitlements
  WHERE id = p_entitlement_id;
  IF v_center_id IS NULL OR NOT app_private.has_center_role(v_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.void_entitlement_admin_impl_v1(
    p_entitlement_id, p_reason, p_actor_employee_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_entitlement_v1(
  p_entitlement_id UUID,
  p_reason TEXT,
  p_actor_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_center_id UUID;
BEGIN
  SELECT center_id INTO v_center_id
  FROM public.customer_entitlements
  WHERE id = p_entitlement_id;
  IF v_center_id IS NULL OR NOT app_private.has_center_role(v_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN public.expire_entitlement_admin_impl_v1(
    p_entitlement_id, p_reason, p_actor_employee_id
  );
END;
$$;

-- Exact grants: private implementations remain owner-only.
REVOKE ALL ON FUNCTION public.upsert_notification_settings_v1(UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_payment_gateway_settings_v1(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_customer_review_v1(UUID, UUID, UUID, SMALLINT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_service_file_v1(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT[], TEXT[], TEXT[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_accounting_journal_entry_v1(UUID, DATE, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_ai_booking_lead_v1(UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_entitlement_v1(UUID, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expire_entitlement_v1(UUID, TEXT, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_notification_settings_v1(UUID, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_payment_gateway_settings_v1(UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_review_v1(UUID, UUID, UUID, SMALLINT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_file_v1(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT[], TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_accounting_journal_entry_v1(UUID, DATE, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ai_booking_lead_v1(UUID, TEXT, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_entitlement_v1(UUID, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_entitlement_v1(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_entitlement_v1(UUID, TEXT, UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Govern employee reads/writes. Operational users receive identity fields
--    with compensation redacted; ADMIN receives the full row through the RPC.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_employees_v1(p_center_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_rows JSONB;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;
  v_is_admin := app_private.has_center_role(p_center_id, ARRAY['ADMIN']);
  SELECT COALESCE(jsonb_agg(
    CASE WHEN v_is_admin THEN to_jsonb(e)
    ELSE to_jsonb(e) - 'salary' - 'base_salary' - 'commission_percentage' - 'month_commission_total'
    END ORDER BY e.name
  ), '[]'::jsonb)
  INTO v_rows
  FROM public.employees e
  WHERE e.center_id = p_center_id;
  RETURN jsonb_build_object('employees', v_rows, 'compensation_visible', v_is_admin);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_employee_v1(p_center_id UUID, p_employee JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_row public.employees;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(COALESCE(p_employee->>'name', ''))) = 0 THEN
    RAISE EXCEPTION 'employee_name_required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.employees (
    center_id, name, phone, role, salary, base_salary,
    commission_percentage, is_active
  ) VALUES (
    p_center_id,
    btrim(p_employee->>'name'),
    NULLIF(btrim(COALESCE(p_employee->>'phone', '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_employee->>'role', '')), ''), 'Staff'),
    COALESCE((p_employee->>'salary')::NUMERIC, 0),
    COALESCE((p_employee->>'baseSalary')::NUMERIC, (p_employee->>'salary')::NUMERIC, 0),
    COALESCE((p_employee->>'commissionPercentage')::NUMERIC, 0),
    COALESCE((p_employee->>'isActive')::BOOLEAN, TRUE)
  ) RETURNING * INTO v_row;
  RETURN jsonb_build_object('employee', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_employee_v1(
  p_center_id UUID,
  p_employee_id UUID,
  p_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_row public.employees;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_patch ? 'name' AND length(btrim(COALESCE(p_patch->>'name', ''))) = 0 THEN
    RAISE EXCEPTION 'employee_name_required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.employees e
  SET
    name = CASE WHEN p_patch ? 'name' THEN btrim(p_patch->>'name') ELSE e.name END,
    phone = CASE WHEN p_patch ? 'phone' THEN NULLIF(btrim(COALESCE(p_patch->>'phone', '')), '') ELSE e.phone END,
    role = CASE WHEN p_patch ? 'role' THEN COALESCE(NULLIF(btrim(p_patch->>'role'), ''), e.role) ELSE e.role END,
    salary = CASE WHEN p_patch ? 'salary' THEN (p_patch->>'salary')::NUMERIC ELSE e.salary END,
    base_salary = CASE WHEN p_patch ? 'baseSalary' THEN (p_patch->>'baseSalary')::NUMERIC ELSE e.base_salary END,
    commission_percentage = CASE WHEN p_patch ? 'commissionPercentage' THEN (p_patch->>'commissionPercentage')::NUMERIC ELSE e.commission_percentage END,
    is_active = CASE WHEN p_patch ? 'isActive' THEN (p_patch->>'isActive')::BOOLEAN ELSE e.is_active END
  WHERE e.id = p_employee_id AND e.center_id = p_center_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'employee_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('employee', to_jsonb(v_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_employee_v1(p_center_id UUID, p_employee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_deactivated UUID;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION 'admin_role_required' USING ERRCODE = '42501';
  END IF;
  -- Legacy clients may still call the old delete-named RPC. Preserve history by
  -- converting that request to the supported lifecycle operation.
  UPDATE public.employees
  SET is_active = FALSE, updated_at = now()
  WHERE id = p_employee_id AND center_id = p_center_id
  RETURNING id INTO v_deactivated;
  IF v_deactivated IS NULL THEN
    RAISE EXCEPTION 'employee_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object('deactivated_employee_id', v_deactivated);
END;
$$;

REVOKE ALL ON FUNCTION public.list_employees_v1(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_employee_v1(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_employee_v1(UUID, UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_employee_v1(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_employees_v1(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_employee_v1(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_employee_v1(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_employee_v1(UUID, UUID) TO authenticated;

-- Remove broad compensation/table-write privileges inherited from hosted
-- defaults. Relation embeds still work through the explicitly safe columns.
REVOKE ALL ON public.employees FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.employees FROM authenticated;
REVOKE SELECT ON public.employees FROM authenticated;
GRANT SELECT (id, center_id, name, role, phone, is_active, created_at, updated_at) ON public.employees TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Align direct-table policies with current route boundaries.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS employees_tenant ON public.employees;
DROP POLICY IF EXISTS employees_member_select ON public.employees;
DROP POLICY IF EXISTS employees_admin_insert ON public.employees;
DROP POLICY IF EXISTS employees_admin_update ON public.employees;
DROP POLICY IF EXISTS employees_admin_delete ON public.employees;
CREATE POLICY employees_member_select ON public.employees
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));
CREATE POLICY employees_admin_insert ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));
CREATE POLICY employees_admin_update ON public.employees
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));
CREATE POLICY employees_admin_delete ON public.employees
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS expenses_tenant ON public.expenses;
DROP POLICY IF EXISTS expenses_admin ON public.expenses;
CREATE POLICY expenses_admin ON public.expenses
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS center_settings_write ON public.center_settings;
DROP POLICY IF EXISTS center_settings_insert ON public.center_settings;
DROP POLICY IF EXISTS center_settings_update ON public.center_settings;
DROP POLICY IF EXISTS center_settings_admin_insert ON public.center_settings;
DROP POLICY IF EXISTS center_settings_admin_update ON public.center_settings;
CREATE POLICY center_settings_admin_insert ON public.center_settings
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));
CREATE POLICY center_settings_admin_update ON public.center_settings
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS notification_settings_insert_member ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_select_member ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_update_member ON public.notification_settings;
DROP POLICY IF EXISTS notification_settings_admin ON public.notification_settings;
CREATE POLICY notification_settings_admin ON public.notification_settings
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

DROP POLICY IF EXISTS payment_gateway_settings_insert_member ON public.payment_gateway_settings;
DROP POLICY IF EXISTS payment_gateway_settings_select_member ON public.payment_gateway_settings;
DROP POLICY IF EXISTS payment_gateway_settings_update_member ON public.payment_gateway_settings;
DROP POLICY IF EXISTS payment_gateway_settings_admin ON public.payment_gateway_settings;
CREATE POLICY payment_gateway_settings_admin ON public.payment_gateway_settings
  FOR ALL TO authenticated
  USING (app_private.has_center_role(center_id, ARRAY['ADMIN']))
  WITH CHECK (app_private.has_center_role(center_id, ARRAY['ADMIN']));

-- Admin-only tables that were previously membership-scoped.
DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounting_journal_entries', 'ai_booking_leads', 'customer_reviews',
    'service_files', 'service_file_images', 'customer_notification_timeline'
  ] LOOP
    FOR policy_name IN
      SELECT pol.polname
      FROM pg_policy pol
      JOIN pg_class cls ON cls.oid = pol.polrelid
      JOIN pg_namespace ns ON ns.oid = cls.relnamespace
      WHERE ns.nspname = 'public' AND cls.relname = table_name
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (app_private.has_center_role(center_id, ARRAY[''ADMIN''])) WITH CHECK (app_private.has_center_role(center_id, ARRAY[''ADMIN'']))',
      table_name || '_admin', table_name
    );
  END LOOP;
END;
$$;

-- Storage reads remain available to members for receipts/branding. Only ADMIN
-- may create or replace center assets.
DROP POLICY IF EXISTS center_assets_member_insert ON storage.objects;
DROP POLICY IF EXISTS center_assets_member_update ON storage.objects;
DROP POLICY IF EXISTS center_assets_admin_insert ON storage.objects;
DROP POLICY IF EXISTS center_assets_admin_update ON storage.objects;
CREATE POLICY center_assets_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.has_center_role(app_private.storage_path_center_id(name), ARRAY['ADMIN'])
  );
CREATE POLICY center_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.has_center_role(app_private.storage_path_center_id(name), ARRAY['ADMIN'])
  )
  WITH CHECK (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.has_center_role(app_private.storage_path_center_id(name), ARRAY['ADMIN'])
  );

-- -----------------------------------------------------------------------------
-- 5. Contain hard deletion and direct writes that bypass governed workflows.
--    Existing create/edit/status journeys remain available; historical records
--    require explicit lifecycle/reversal RPCs rather than PostgREST DELETE.
-- -----------------------------------------------------------------------------
REVOKE DELETE ON
  public.customers,
  public.employees,
  public.services,
  public.service_categories,
  public.products,
  public.appointments,
  public.expenses,
  public.attendance_records,
  public.employee_advances,
  public.center_settings
FROM PUBLIC, anon, authenticated;

-- These tables are written through the ADMIN-checking SECURITY DEFINER wrappers
-- above (or are immutable history children), never by direct browser writes.
REVOKE INSERT, UPDATE, DELETE ON
  public.notification_settings,
  public.payment_gateway_settings,
  public.accounting_journal_entries,
  public.ai_booking_leads,
  public.customer_reviews,
  public.service_files,
  public.service_file_images,
  public.customer_notification_timeline,
  public.service_packages,
  public.service_package_items
FROM PUBLIC, anon, authenticated;

COMMIT;

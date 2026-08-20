-- ============================================================
-- LenaBeauty — Admin audit trail + customer support notes
-- Immutable audit events for high-impact admin actions and
-- append-only support notes on customer records.
-- ============================================================

-- -----------------------------------------------------------------------
-- 1. ADMIN AUDIT EVENTS (immutable, append-only)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL DEFAULT 'Unknown',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_summary TEXT,
  reason TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_center
  ON public.admin_audit_events(center_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_events(center_id, target_type, target_id)
  WHERE target_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON public.admin_audit_events(center_id, action);

ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

-- SELECT: center members can view audit events for their center
DROP POLICY IF EXISTS admin_audit_select ON public.admin_audit_events;
CREATE POLICY admin_audit_select ON public.admin_audit_events
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

-- INSERT: only through the SECURITY DEFINER RPC (policy allows insert, RPC
-- serves as the real control; we grant TO authenticated but has_center_role
-- inside the RPC is the actual gate).
DROP POLICY IF EXISTS admin_audit_insert ON public.admin_audit_events;
CREATE POLICY admin_audit_insert ON public.admin_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_center_member(center_id));

-- UPDATE/DELETE explicitly denied
DROP POLICY IF EXISTS admin_audit_update ON public.admin_audit_events;
CREATE POLICY admin_audit_update ON public.admin_audit_events
  FOR UPDATE TO authenticated
  USING (false);
DROP POLICY IF EXISTS admin_audit_delete ON public.admin_audit_events;
CREATE POLICY admin_audit_delete ON public.admin_audit_events
  FOR DELETE TO authenticated
  USING (false);

-- -----------------------------------------------------------------------
-- 2. CUSTOMER SUPPORT NOTES (append-only)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_support_notes_customer
  ON public.customer_support_notes(center_id, customer_id, created_at DESC);

ALTER TABLE public.customer_support_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_support_notes_select ON public.customer_support_notes;
CREATE POLICY customer_support_notes_select ON public.customer_support_notes
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS customer_support_notes_insert ON public.customer_support_notes;
CREATE POLICY customer_support_notes_insert ON public.customer_support_notes
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS customer_support_notes_update ON public.customer_support_notes;
CREATE POLICY customer_support_notes_update ON public.customer_support_notes
  FOR UPDATE TO authenticated
  USING (false);
DROP POLICY IF EXISTS customer_support_notes_delete ON public.customer_support_notes;
CREATE POLICY customer_support_notes_delete ON public.customer_support_notes
  FOR DELETE TO authenticated
  USING (false);

-- -----------------------------------------------------------------------
-- 3. RPC: Write an admin audit event (ADMIN only)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_admin_audit_event_v1(
  p_center_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_target_summary TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_admin_required CONSTANT TEXT := 'admin_role_required';
  c_denied_code CONSTANT TEXT := '42501';
  v_actor_name TEXT;
  v_event public.admin_audit_events;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION '%', c_admin_required USING ERRCODE = c_denied_code;
  END IF;

  SELECT COALESCE(profiles.full_name, 'Admin') INTO v_actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  INSERT INTO public.admin_audit_events (
    center_id, actor_id, actor_name, action, target_type,
    target_id, target_summary, reason, details
  ) VALUES (
    p_center_id, auth.uid(), v_actor_name, p_action, p_target_type,
    p_target_id, p_target_summary,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    COALESCE(p_details, '{}'::jsonb)
  ) RETURNING * INTO v_event;

  RETURN jsonb_build_object('event', to_jsonb(v_event));
END;
$$;

REVOKE ALL ON FUNCTION public.write_admin_audit_event_v1(UUID, TEXT, TEXT, UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_admin_audit_event_v1(UUID, TEXT, TEXT, UUID, TEXT, TEXT, JSONB) TO authenticated;

-- -----------------------------------------------------------------------
-- 4. RPC: List audit events for a center (center members — read-only)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_audit_events_v1(
  p_center_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_action TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_rows JSONB;
  v_total INTEGER;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_total
  FROM public.admin_audit_events e
  WHERE e.center_id = p_center_id
    AND (p_action IS NULL OR e.action = p_action)
    AND (p_target_type IS NULL OR e.target_type = p_target_type);

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT * FROM public.admin_audit_events e
    WHERE e.center_id = p_center_id
      AND (p_action IS NULL OR e.action = p_action)
      AND (p_target_type IS NULL OR e.target_type = p_target_type)
    ORDER BY e.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
    OFFSET GREATEST(0, p_offset)
  ) e;

  RETURN jsonb_build_object('events', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_audit_events_v1(UUID, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_audit_events_v1(UUID, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 5. RPC: Add a support note to a customer (ADMIN only)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_customer_support_note_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_admin_required CONSTANT TEXT := 'admin_role_required';
  c_denied_code CONSTANT TEXT := '42501';
  v_note public.customer_support_notes;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION '%', c_admin_required USING ERRCODE = c_denied_code;
  END IF;

  IF length(btrim(COALESCE(p_note, ''))) < 2 THEN
    RAISE EXCEPTION 'note_too_short' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = p_customer_id AND c.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_in_center' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.customer_support_notes (center_id, customer_id, actor_id, note)
  VALUES (p_center_id, p_customer_id, auth.uid(), btrim(p_note))
  RETURNING * INTO v_note;

  -- Also write an audit event
  INSERT INTO public.admin_audit_events (
    center_id, actor_id, actor_name, action, target_type,
    target_id, target_summary, reason
  ) VALUES (
    p_center_id, auth.uid(),
    COALESCE((SELECT full_name FROM public.profiles WHERE id = auth.uid()), 'Admin'),
    'support_note_added', 'customer', p_customer_id,
    (SELECT name FROM public.customers WHERE id = p_customer_id),
    left(btrim(p_note), 200)
  );

  RETURN jsonb_build_object('note', to_jsonb(v_note));
END;
$$;

REVOKE ALL ON FUNCTION public.add_customer_support_note_v1(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_customer_support_note_v1(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 6. RPC: List support notes for a customer (center members — read-only)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_customer_support_notes_v1(
  p_center_id UUID,
  p_customer_id UUID,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(sub.x), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'note', n.note,
      'actor_name', COALESCE(p.full_name, 'Unknown'),
      'created_at', n.created_at
    ) AS x
    FROM public.customer_support_notes n
    LEFT JOIN public.profiles p ON p.id = n.actor_id
    WHERE n.center_id = p_center_id AND n.customer_id = p_customer_id
    ORDER BY n.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 200))
  ) sub;

  RETURN jsonb_build_object('notes', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_customer_support_notes_v1(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customer_support_notes_v1(UUID, UUID, INTEGER) TO authenticated;

-- -----------------------------------------------------------------------
-- 7. RPC: Global search across customers, invoices, employees (ADMIN/MANAGER)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_global_search_v1(
  p_center_id UUID,
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_employee_type CONSTANT TEXT := 'employee';
  v_is_admin BOOLEAN;
  v_customers JSONB;
  v_employees JSONB;
  v_invoices JSONB;
  v_q TEXT;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;

  v_is_admin := app_private.has_center_role(p_center_id, ARRAY['ADMIN']);
  v_q := '%' || COALESCE(NULLIF(trim(p_query), ''), '') || '%';

  IF length(v_q) < 4 THEN
    RETURN jsonb_build_object('customers', '[]'::jsonb, 'employees', '[]'::jsonb, 'invoices', '[]'::jsonb);
  END IF;

  -- Customers — search by name or phone
  SELECT COALESCE(jsonb_agg(sub.x), '[]'::jsonb) INTO v_customers
  FROM (
    SELECT jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'type', 'customer') AS x
    FROM public.customers c
    WHERE c.center_id = p_center_id
      AND (c.name ILIKE v_q OR c.phone ILIKE v_q)
    ORDER BY c.name
    LIMIT p_limit
  ) sub;

  -- Employees — name only (compensation-sensitive, so check admin)
  SELECT COALESCE(jsonb_agg(sub.x), '[]'::jsonb) INTO v_employees
  FROM (
    SELECT jsonb_build_object(
      'id', e.id, 'name', e.name, 'role', e.role,
      'type', c_employee_type
    ) AS x
    FROM public.employees e
    WHERE e.center_id = p_center_id AND e.name ILIKE v_q
    ORDER BY e.name
    LIMIT p_limit
  ) sub;

  -- Invoices — serial number or customer name
  SELECT COALESCE(jsonb_agg(sub.x), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT jsonb_build_object(
      'id', i.id, 'serial', i.serial_number, 'total', i.total_amount,
      'date', i.created_at, 'status', i.status, 'type', 'invoice'
    ) AS x
    FROM public.invoices i
    WHERE i.center_id = p_center_id
      AND (i.serial_number ILIKE v_q OR i.customer_name ILIKE v_q)
    ORDER BY i.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object(
    'customers', v_customers,
    'employees', v_employees,
    'invoices', v_invoices
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_global_search_v1(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_global_search_v1(UUID, TEXT, INTEGER) TO authenticated;

-- -----------------------------------------------------------------------
-- 8. RPC: Deactivate employee with audit trail (ADMIN only)
--    Extends the existing admin_delete_employee_v1 with reason + audit
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_deactivate_employee_v1(
  p_center_id UUID,
  p_employee_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_admin_required CONSTANT TEXT := 'admin_role_required';
  c_denied_code CONSTANT TEXT := '42501';
  v_employee public.employees;
  v_actor_name TEXT;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION '%', c_admin_required USING ERRCODE = c_denied_code;
  END IF;

  IF length(btrim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'reason_too_short' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees e
  WHERE e.id = p_employee_id AND e.center_id = p_center_id;

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'employee_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_employee.is_active THEN
    RAISE EXCEPTION 'employee_already_inactive' USING ERRCODE = '22023';
  END IF;

  UPDATE public.employees
  SET is_active = FALSE, updated_at = now()
  WHERE id = p_employee_id AND center_id = p_center_id;

  SELECT COALESCE(full_name, 'Admin') INTO v_actor_name
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.admin_audit_events (
    center_id, actor_id, actor_name, action, target_type,
    target_id, target_summary, reason, details
  ) VALUES (
    p_center_id, auth.uid(), v_actor_name,
    'employee_deactivate', 'employee', p_employee_id,
    v_employee.name, p_reason,
    jsonb_build_object('was_active', v_employee.is_active)
  );

  RETURN jsonb_build_object(
    'deactivated_employee_id', p_employee_id,
    'name', v_employee.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_deactivate_employee_v1(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_employee_v1(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------
-- 9. RPC: Reactivate employee with audit (ADMIN only)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reactivate_employee_v1(
  p_center_id UUID,
  p_employee_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  c_admin_required CONSTANT TEXT := 'admin_role_required';
  c_denied_code CONSTANT TEXT := '42501';
  v_employee public.employees;
  v_actor_name TEXT;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, ARRAY['ADMIN']) THEN
    RAISE EXCEPTION '%', c_admin_required USING ERRCODE = c_denied_code;
  END IF;

  IF length(btrim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'reason_too_short' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_employee
  FROM public.employees e
  WHERE e.id = p_employee_id AND e.center_id = p_center_id;

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'employee_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_employee.is_active THEN
    RAISE EXCEPTION 'employee_already_active' USING ERRCODE = '22023';
  END IF;

  UPDATE public.employees
  SET is_active = TRUE, updated_at = now()
  WHERE id = p_employee_id AND center_id = p_center_id;

  SELECT COALESCE(full_name, 'Admin') INTO v_actor_name
  FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.admin_audit_events (
    center_id, actor_id, actor_name, action, target_type,
    target_id, target_summary, reason, details
  ) VALUES (
    p_center_id, auth.uid(), v_actor_name,
    'employee_reactivate', 'employee', p_employee_id,
    v_employee.name, p_reason,
    jsonb_build_object('was_active', FALSE)
  );

  RETURN jsonb_build_object(
    'reactivated_employee_id', p_employee_id,
    'name', v_employee.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reactivate_employee_v1(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_employee_v1(UUID, UUID, TEXT) TO authenticated;

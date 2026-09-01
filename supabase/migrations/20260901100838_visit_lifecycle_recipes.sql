-- =============================================================================
-- LenaBeauty — Visit lifecycle, service recipes, and the appointment→checkout
-- bridge (additive).
--
-- Goals, all strictly additive (no destructive schema changes, no historical
-- financial rows touched):
--   1. `visit_stage` refines a SCHEDULED appointment into the operational
--      visit lifecycle (BOOKED → CONFIRMED → ARRIVED → IN_SERVICE →
--      READY_FOR_CHECKOUT). Terminal appointment states stay authoritative.
--   2. `invoices.appointment_id` preserves the booking reference at checkout
--      so payment never silently loses its origin.
--   3. `service_recipes` / `service_recipe_items` model the consumables a
--      service uses; `inventory_consumptions` is the immutable, idempotent
--      record of stock consumed by a paid visit.
--   4. `process_checkout_idempotent_v1` gains `p_appointment_id`: when the
--      operator checks out a visit, the appointment is marked COMPLETED and
--      its recipes are consumed — atomically, idempotently, and only once.
--
-- OMR precision stays NUMERIC(12,3); negative stock protection is preserved.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Visit stage enum (additive; appointment_status unchanged)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE visit_stage AS ENUM (
    'BOOKED',
    'CONFIRMED',
    'ARRIVED',
    'IN_SERVICE',
    'READY_FOR_CHECKOUT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS visit_stage visit_stage,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_appointment ON public.invoices(appointment_id);

-- -----------------------------------------------------------------------------
-- 2. Service recipes (stock a service consumes while delivered)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_recipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id  UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_recipes_service_unique UNIQUE (center_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.service_recipe_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  recipe_id      UUID NOT NULL REFERENCES public.service_recipes(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity       NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit           TEXT,
  estimated_cost NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A recipe lists each product once. Duplicate rows would make the
  -- consumption idempotency key (invoice_id, service_id, product_id) silently
  -- drop the later duplicates' quantities, under-counting consumed stock.
  CONSTRAINT service_recipe_items_product_unique UNIQUE (recipe_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_service_recipes_center ON public.service_recipes(center_id);
CREATE INDEX IF NOT EXISTS idx_service_recipe_items_recipe ON public.service_recipe_items(recipe_id);

-- Immutable consumption record. Written ONLY by the checkout transaction.
-- (invoice_id, service_id, product_id) is the idempotency key: retries and
-- edits can never double-consume.
CREATE TABLE IF NOT EXISTS public.inventory_consumptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES public.centers(id) ON DELETE RESTRICT,
  invoice_id     UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id     UUID REFERENCES public.services(id) ON DELETE SET NULL,
  product_id     UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity       NUMERIC(12,3) NOT NULL,
  unit           TEXT,
  unit_cost      NUMERIC(12,3) NOT NULL DEFAULT 0,
  consumed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_consumptions_once UNIQUE (invoice_id, service_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_appointment ON public.inventory_consumptions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_inventory_consumptions_invoice ON public.inventory_consumptions(invoice_id);

-- -----------------------------------------------------------------------------
-- 3. RLS for the new tables (same tenant boundary as services/products)
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_recipes_tenant ON public.service_recipes;
CREATE POLICY service_recipes_tenant ON public.service_recipes
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS service_recipe_items_tenant ON public.service_recipe_items;
CREATE POLICY service_recipe_items_tenant ON public.service_recipe_items
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

DROP POLICY IF EXISTS inventory_consumptions_member_select ON public.inventory_consumptions;
CREATE POLICY inventory_consumptions_member_select ON public.inventory_consumptions
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

REVOKE INSERT, UPDATE, DELETE ON public.inventory_consumptions FROM anon, authenticated;
GRANT SELECT ON public.inventory_consumptions TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. transition_visit_v1 — the server-authoritative visit state machine.
--    A client can never skip a stage; stage moves forward only (with the two
--    documented exceptions: BOOKED→ARRIVED and READY_FOR_CHECKOUT→IN_SERVICE).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_visit_v1(
  p_center_id     UUID,
  p_appointment_id UUID,
  p_stage         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_current     TEXT;
  v_valid       BOOLEAN := false;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;
  IF p_stage NOT IN ('BOOKED', 'CONFIRMED', 'ARRIVED', 'IN_SERVICE', 'READY_FOR_CHECKOUT') THEN
    RAISE EXCEPTION 'invalid_visit_stage' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id AND a.center_id = p_center_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '23503';
  END IF;

  IF v_appointment.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'appointment_not_scheduled' USING ERRCODE = '23514';
  END IF;

  v_current := COALESCE(v_appointment.visit_stage::text, 'BOOKED');

  IF v_current = 'BOOKED' THEN
    v_valid := p_stage IN ('CONFIRMED', 'ARRIVED');
  ELSIF v_current = 'CONFIRMED' THEN
    v_valid := p_stage = 'ARRIVED';
  ELSIF v_current = 'ARRIVED' THEN
    v_valid := p_stage = 'IN_SERVICE';
  ELSIF v_current = 'IN_SERVICE' THEN
    v_valid := p_stage = 'READY_FOR_CHECKOUT';
  ELSIF v_current = 'READY_FOR_CHECKOUT' THEN
    v_valid := p_stage = 'IN_SERVICE';
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'invalid_visit_transition' USING ERRCODE = '23514';
  END IF;

  UPDATE public.appointments a
  SET visit_stage = p_stage::public.visit_stage,
      started_at  = CASE WHEN p_stage = 'IN_SERVICE'
                         THEN COALESCE(a.started_at, now()) ELSE a.started_at END,
      updated_at  = now()
  WHERE a.id = p_appointment_id;

  RETURN jsonb_build_object(
    'appointment_id', p_appointment_id,
    'stage', p_stage
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_visit_v1(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_visit_v1(UUID, UUID, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. save_service_recipe_v1 — atomic recipe upsert (replace items in one txn).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_service_recipe_v1(
  p_center_id UUID,
  p_service_id UUID,
  p_items     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_recipe_id UUID;
  v_item      JSONB;
  v_product   UUID;
  v_qty       NUMERIC(12,3);
  v_unit      TEXT;
  v_cost      NUMERIC(12,3);
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.services s
  WHERE s.id = p_service_id AND s.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_not_available' USING ERRCODE = '23503';
  END IF;

  SELECT id INTO v_recipe_id
  FROM public.service_recipes sr
  WHERE sr.service_id = p_service_id AND sr.center_id = p_center_id
  FOR UPDATE;

  IF v_recipe_id IS NULL THEN
    INSERT INTO public.service_recipes (center_id, service_id, is_active)
    VALUES (p_center_id, p_service_id, true)
    RETURNING id INTO v_recipe_id;
  ELSE
    DELETE FROM public.service_recipe_items sri WHERE sri.recipe_id = v_recipe_id;
    UPDATE public.service_recipes SET is_active = true, updated_at = now()
    WHERE id = v_recipe_id;
  END IF;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_items) AS it
      WHERE NULLIF(it->>'productId', '') IS NOT NULL
      GROUP BY it->>'productId'
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'duplicate_recipe_product' USING ERRCODE = '22023';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      v_product := NULLIF(v_item->>'productId', '')::UUID;
      v_qty     := NULLIF(v_item->>'quantity', '')::NUMERIC;
      v_unit    := NULLIF(v_item->>'unit', '');
      v_cost    := COALESCE(NULLIF(v_item->>'estimatedCost', '')::NUMERIC, 0);

      IF v_product IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
        RAISE EXCEPTION 'invalid_recipe_item' USING ERRCODE = '22023';
      END IF;

      PERFORM 1 FROM public.products p
      WHERE p.id = v_product AND p.center_id = p_center_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'recipe_product_not_available' USING ERRCODE = '23503';
      END IF;

      INSERT INTO public.service_recipe_items
        (center_id, recipe_id, product_id, quantity, unit, estimated_cost)
      VALUES
        (p_center_id, v_recipe_id, v_product, round(v_qty, 3), v_unit, round(v_cost, 3));
    END LOOP;
  END IF;

  RETURN jsonb_build_object('recipe_id', v_recipe_id, 'service_id', p_service_id);
END;
$$;

REVOKE ALL ON FUNCTION public.save_service_recipe_v1(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_service_recipe_v1(UUID, UUID, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Recipe consumption (invoked by the checkout wrapper only).
--
--    Idempotent by (invoice_id, service_id, product_id). Stock is decremented
--    only for whole-unit consumption of tracked products, with the canonical
--    negative-stock guard. Fractional (ml-scale) consumables are recorded for
--    costing but do not drive integer bottle counts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.consume_invoice_recipes_v1(
  p_center_id UUID,
  p_invoice_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_line     RECORD;
  v_item     RECORD;
  v_recipe   UUID;
  v_total    NUMERIC(12,3);
  v_consumed INTEGER := 0;
BEGIN
  FOR v_line IN
    SELECT ii.service_id, ii.quantity AS service_qty
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id AND ii.service_id IS NOT NULL
  LOOP
    SELECT sr.id INTO v_recipe
    FROM public.service_recipes sr
    WHERE sr.service_id = v_line.service_id
      AND sr.center_id = p_center_id
      AND sr.is_active = true
    ORDER BY sr.updated_at DESC
    LIMIT 1;

    CONTINUE WHEN v_recipe IS NULL;

    FOR v_item IN
      SELECT sri.product_id, sri.quantity AS qty, sri.unit, sri.estimated_cost
      FROM public.service_recipe_items sri
      WHERE sri.recipe_id = v_recipe
    LOOP
      v_total := round(v_item.qty * v_line.service_qty, 3);

      INSERT INTO public.inventory_consumptions
        (center_id, invoice_id, service_id, product_id, quantity, unit, unit_cost)
      VALUES
        (p_center_id, p_invoice_id, v_line.service_id, v_item.product_id,
         v_total, v_item.unit, COALESCE(v_item.estimated_cost, 0))
      ON CONFLICT (invoice_id, service_id, product_id) DO NOTHING;

      IF FOUND THEN
        -- Whole-unit, tracked consumables decrement stock with the canonical
        -- negative-stock protection.
        IF v_total = floor(v_total) THEN
          UPDATE public.products p
          SET stock_quantity = p.stock_quantity - v_total::integer
          WHERE p.id = v_item.product_id
            AND p.center_id = p_center_id
            AND p.track_inventory = true
            AND p.stock_quantity >= v_total::integer;
          IF NOT FOUND THEN
            PERFORM 1 FROM public.products p
            WHERE p.id = v_item.product_id
              AND p.center_id = p_center_id
              AND p.track_inventory = false;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'insufficient_consumable_stock' USING ERRCODE = '23514';
            END IF;
          END IF;
        END IF;
        v_consumed := v_consumed + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('consumed_lines', v_consumed);
END;
$$;

-- Internal helper invoked only by the SECURITY DEFINER checkout wrapper; never
-- executable by a client role. The explicit REVOKE also keeps the function's
-- ACL deterministic across chain re-application (fingerprint stability).
REVOKE ALL ON FUNCTION app_private.consume_invoice_recipes_v1(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Idempotent checkout wrapper: preserve the booking reference, close the
--    visit (paid ⇒ completed) and consume recipes — all in one transaction.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_checkout_idempotent_v1(
  UUID, UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB
);

CREATE OR REPLACE FUNCTION public.process_checkout_idempotent_v1(
  p_request_id UUID,
  p_center_id UUID,
  p_customer_id UUID,
  p_employee_id UUID,
  p_payment_method TEXT,
  p_discount_amount NUMERIC,
  p_use_loyalty_points BOOLEAN,
  p_items JSONB,
  p_gift_card_code TEXT DEFAULT NULL,
  p_entitlement_redemptions JSONB DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
  v_result JSONB;
  v_invoice_id UUID;
  v_appt public.appointments%ROWTYPE;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'checkout_request_id_required' USING ERRCODE = '22023';
  END IF;
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'not_authorized_for_center' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.checkout_idempotency(center_id, request_id)
  VALUES (p_center_id, p_request_id)
  ON CONFLICT (center_id, request_id) DO NOTHING;

  SELECT record.result
  INTO v_result
  FROM public.checkout_idempotency AS record
  WHERE record.center_id = p_center_id AND record.request_id = p_request_id
  FOR UPDATE;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  v_result := public.process_checkout_v1(
    p_center_id,
    p_customer_id,
    p_employee_id,
    p_payment_method,
    p_discount_amount,
    p_use_loyalty_points,
    p_items,
    p_gift_card_code,
    p_entitlement_redemptions
  );

  v_invoice_id := (v_result->'invoice'->>'id')::UUID;
  IF v_invoice_id IS NULL THEN
    RAISE EXCEPTION 'checkout_result_missing_invoice' USING ERRCODE = 'P0001';
  END IF;

  -- Booking reference + visit closure: paid ⇒ completed, recipes consumed.
  IF p_appointment_id IS NOT NULL THEN
    SELECT * INTO v_appt
    FROM public.appointments a
    WHERE a.id = p_appointment_id AND a.center_id = p_center_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '23503';
    END IF;
    IF v_appt.status <> 'SCHEDULED' THEN
      RAISE EXCEPTION 'appointment_not_scheduled' USING ERRCODE = '23514';
    END IF;
    IF v_appt.customer_id <> p_customer_id THEN
      RAISE EXCEPTION 'appointment_customer_mismatch' USING ERRCODE = '23503';
    END IF;

    UPDATE public.invoices
    SET appointment_id = p_appointment_id
    WHERE id = v_invoice_id;

    UPDATE public.appointments
    SET status = 'COMPLETED',
        visit_stage = NULL,
        completed_at = now(),
        updated_at = now()
    WHERE id = p_appointment_id;

    PERFORM app_private.consume_invoice_recipes_v1(p_center_id, v_invoice_id);

    v_result := v_result || jsonb_build_object('appointment_id', p_appointment_id);
  END IF;

  UPDATE public.checkout_idempotency
  SET result = v_result, invoice_id = v_invoice_id, completed_at = now()
  WHERE center_id = p_center_id AND request_id = p_request_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_idempotent_v1(
  UUID, UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_checkout_idempotent_v1(
  UUID, UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB, UUID
) TO authenticated;

COMMIT;

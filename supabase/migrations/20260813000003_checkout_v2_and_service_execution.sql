-- =============================================================================
-- LenaBeauty — Service execution, split payments, tips, and service BOM
-- -----------------------------------------------------------------------------
-- 1. Service BOM (bill of materials): dyes / oils / consumables per service,
--    consumed atomically at checkout and recorded with a COGS snapshot.
-- 2. process_checkout_v2 — canonical checkout superset:
--      * split tenders (multiple payment methods on one invoice)
--      * tips / gratuity tracked separately from service revenue
--      * service BOM consumption + COGS
--      * commission accrual on net paid service revenue
--      * gift-card / package sale + entitlement redemption (parity with v1)
--      * full-balance enforcement: tender sum must equal the invoice total
-- 3. complete_appointment_v1 — one transaction that ties an appointment to its
--    checkout (invoice + payment), entitlement consumption, staff commission
--    and material usage, then flips the appointment to COMPLETED.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Invoice -> appointment traceability
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_appointment ON public.invoices(appointment_id);

-- -----------------------------------------------------------------------------
-- 2. Service BOM (bill of materials)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_bom_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_used INTEGER NOT NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_bom_items_positive CHECK (quantity_used > 0),
  CONSTRAINT service_bom_items_unique UNIQUE (service_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_service_bom_items_service ON public.service_bom_items(service_id);

ALTER TABLE public.service_bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_bom_items_member_select ON public.service_bom_items;
CREATE POLICY service_bom_items_member_select ON public.service_bom_items
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS service_bom_items_manager_insert ON public.service_bom_items;
CREATE POLICY service_bom_items_manager_insert ON public.service_bom_items
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

DROP POLICY IF EXISTS service_bom_items_manager_update ON public.service_bom_items;
CREATE POLICY service_bom_items_manager_update ON public.service_bom_items
  FOR UPDATE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'))
  WITH CHECK (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

DROP POLICY IF EXISTS service_bom_items_manager_delete ON public.service_bom_items;
CREATE POLICY service_bom_items_manager_delete ON public.service_bom_items
  FOR DELETE TO authenticated
  USING (app_private.has_center_role(center_id, 'ADMIN', 'MANAGER'));

-- -----------------------------------------------------------------------------
-- 3. Material consumption ledger (append-only, COGS snapshot)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_material_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id      UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  invoice_id     UUID REFERENCES public.invoices(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  service_id     UUID REFERENCES public.services(id) ON DELETE RESTRICT,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_used  INTEGER NOT NULL,
  unit_cost      NUMERIC(12,3) NOT NULL,
  cogs           NUMERIC(12,3) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_material_usage_positive
    CHECK (quantity_used > 0 AND unit_cost >= 0 AND cogs >= 0)
);

CREATE INDEX IF NOT EXISTS idx_service_material_usage_center
  ON public.service_material_usage(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_material_usage_invoice
  ON public.service_material_usage(invoice_id);

ALTER TABLE public.service_material_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_material_usage_member_select ON public.service_material_usage;
CREATE POLICY service_material_usage_member_select ON public.service_material_usage
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

REVOKE INSERT, UPDATE, DELETE ON public.service_material_usage FROM anon, authenticated;
GRANT SELECT ON public.service_material_usage TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Manage a service's BOM (governed)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_service_bom_v1(
  p_center_id UUID,
  p_service_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item      JSONB;
  v_product_id UUID;
  v_qty       INTEGER;
  v_count     INTEGER := 0;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.has_center_role(p_center_id, 'ADMIN', 'MANAGER') THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.services s
  WHERE s.id = p_service_id AND s.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_not_found' USING ERRCODE = '23503';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'bom_items_must_be_an_array' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.service_bom_items
  WHERE center_id = p_center_id AND service_id = p_service_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := NULLIF(v_item->>'productId', '')::uuid;
    v_qty := NULLIF(v_item->>'quantity', '')::integer;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_bom_item' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.products p
    WHERE p.id = v_product_id AND p.center_id = p_center_id AND p.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'bom_material_not_available' USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.service_bom_items (center_id, service_id, product_id, quantity_used, note)
    VALUES (p_center_id, p_service_id, v_product_id, v_qty, NULLIF(v_item->>'note', ''))
    ON CONFLICT (service_id, product_id) DO UPDATE SET
      quantity_used = EXCLUDED.quantity_used,
      note = EXCLUDED.note,
      updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('service_id', p_service_id, 'bom_items', v_count);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Canonical checkout v2 (split tenders + tips + BOM + commission)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_checkout_v2(
    p_center_id               UUID,
    p_customer_id             UUID,
    p_employee_id             UUID,
    p_payment_method          TEXT,
    p_discount_amount         NUMERIC,
    p_use_loyalty_points      BOOLEAN,
    p_items                   JSONB,
    p_gift_card_code          TEXT DEFAULT NULL,
    p_entitlement_redemptions JSONB DEFAULT NULL,
    p_payments                JSONB DEFAULT NULL,
    p_appointment_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_invoice_id            UUID;
    v_subtotal              NUMERIC(12,3) := 0.000;
    v_payable               NUMERIC(12,3) := 0.000;
    v_net                   NUMERIC(12,3) := 0.000;
    v_tax_rate              NUMERIC(5,2)  := 0.000;
    v_tax_amount            NUMERIC(12,3) := 0.000;
    v_total                 NUMERIC(12,3) := 0.000;
    v_manual_discount       NUMERIC(12,3) := 0.000;
    v_tier_percent          NUMERIC(5,2)  := 0.000;
    v_tier_discount         NUMERIC(12,3) := 0.000;
    v_loyalty_discount      NUMERIC(12,3) := 0.000;
    v_gift_card_discount    NUMERIC(12,3) := 0.000;
    v_entitlement_redemption NUMERIC(12,3) := 0.000;
    v_earned_points         INTEGER := 0;
    v_item                  JSONB;
    v_line                  JSONB;
    v_lines                 JSONB := '[]'::jsonb;
    v_redemption            JSONB;
    v_redemptions           JSONB := '[]'::jsonb;
    v_redemption_type       TEXT;
    v_item_type             TEXT;
    v_item_name             TEXT;
    v_item_qty              NUMERIC;
    v_item_price            NUMERIC(12,3);
    v_service_id            UUID;
    v_product_id            UUID;
    v_package_id            UUID;
    v_code                  TEXT;
    v_service               public.services%ROWTYPE;
    v_product               public.products%ROWTYPE;
    v_package               public.service_packages%ROWTYPE;
    v_customer              public.customers%ROWTYPE;
    v_gift_card             public.gift_cards%ROWTYPE;
    v_redeem_card_id        UUID;
    v_gift_code             TEXT := upper(NULLIF(btrim(COALESCE(p_gift_card_code, '')), ''));
    v_entitlement           public.customer_entitlements%ROWTYPE;
    v_ent_id                UUID;
    v_ent_amount            NUMERIC(12,3) := 0.000;
    v_ent_service_id        UUID;
    v_ent_units             INTEGER;
    v_covered               NUMERIC(12,3) := 0.000;
    v_total_units_all       INTEGER := 0;
    v_remaining_units_all   INTEGER := 0;
    v_line_value            NUMERIC(12,3) := 0.000;
    v_line_qty              INTEGER := 0;
    v_avg_unit_price        NUMERIC(12,3) := 0.000;
    v_redeemed_ids          TEXT[] := '{}';
    v_issued_cards          JSONB := '[]'::jsonb;
    v_issued_card           JSONB;
    v_package_ents          JSONB := '[]'::jsonb;
    v_unit_row              public.service_package_items%ROWTYPE;
    v_updated_invoice       JSONB;
    v_package_entitlement   public.customer_entitlements%ROWTYPE;

    -- v2 additions
    v_tender                JSONB;
    v_tender_method         TEXT;
    v_tender_amount         NUMERIC(12,3);
    v_tender_tip            NUMERIC(12,3);
    v_tender_count          INTEGER := 0;
    v_tenders_sum           NUMERIC(12,3) := 0.000;
    v_tips_total            NUMERIC(12,3) := 0.000;
    v_invoice_method        TEXT;
    v_single_method         TEXT;
    v_bom_row               public.service_bom_items%ROWTYPE;
    v_material              public.products%ROWTYPE;
    v_consumed              INTEGER;
    v_cogs_total            NUMERIC(12,3) := 0.000;
    v_commission            NUMERIC(12,3) := 0.000;
    v_payment_rows          JSONB := '[]'::jsonb;
    v_payment               public.payments%ROWTYPE;
BEGIN
    IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
      RAISE EXCEPTION 'unauthorized_checkout_center' USING ERRCODE = '42501';
    END IF;

    IF p_discount_amount IS NOT NULL AND
       (p_discount_amount = 'NaN'::numeric OR p_discount_amount < 0) THEN
      RAISE EXCEPTION 'invalid_manual_discount' USING ERRCODE = '22023';
    END IF;
    v_manual_discount := round(COALESCE(p_discount_amount, 0), 3);

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'checkout_items_required' USING ERRCODE = '22023';
    END IF;

    IF p_entitlement_redemptions IS NOT NULL AND
       jsonb_typeof(p_entitlement_redemptions) <> 'array' THEN
      RAISE EXCEPTION 'invalid_entitlement_redemptions' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_customer
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.center_id = p_center_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'checkout_customer_not_available' USING ERRCODE = '23503';
    END IF;

    IF p_employee_id IS NULL THEN
      RAISE EXCEPTION 'checkout_employee_required' USING ERRCODE = '23502';
    END IF;
    PERFORM 1 FROM public.employees e
    WHERE e.id = p_employee_id AND e.center_id = p_center_id AND e.is_active = true
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'checkout_employee_not_available' USING ERRCODE = '23503';
    END IF;

    IF p_appointment_id IS NOT NULL THEN
      PERFORM 1 FROM public.appointments a
      WHERE a.id = p_appointment_id
        AND a.center_id = p_center_id
        AND a.customer_id = p_customer_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'appointment_not_available' USING ERRCODE = '23503';
      END IF;
    END IF;

    -- Resolve items to canonical lines (parity with process_checkout_v1).
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      BEGIN
        v_item_type := v_item->>'type';
        v_item_qty := NULLIF(v_item->>'qty', '')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'invalid_checkout_line' USING ERRCODE = '22023';
      END;

      IF v_item_type NOT IN ('service', 'product', 'package', 'gift_card') OR
         v_item_qty IS NULL OR v_item_qty = 'NaN'::numeric OR
         v_item_qty <= 0 OR v_item_qty <> trunc(v_item_qty) THEN
        RAISE EXCEPTION 'invalid_checkout_line' USING ERRCODE = '22023';
      END IF;

      v_service_id := NULL;
      v_product_id := NULL;
      v_package_id := NULL;
      v_item_name := NULL;
      v_item_price := NULL;
      v_code := NULL;

      IF v_item_type = 'service' THEN
        BEGIN
          v_service_id := NULLIF(v_item->>'serviceId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_service_reference' USING ERRCODE = '22023';
        END;
        SELECT * INTO v_service FROM public.services s
        WHERE s.id = v_service_id AND s.center_id = p_center_id AND s.is_active = true
        FOR SHARE;
        IF NOT FOUND OR v_service.price <= 0 THEN
          RAISE EXCEPTION 'service_not_available' USING ERRCODE = '23503';
        END IF;
        v_item_name := v_service.name;
        IF v_service.pricing_mode = 'STARTING_FROM' THEN
          BEGIN
            v_item_price := round(NULLIF(v_item->>'price', '')::numeric, 3);
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'final_service_price_required' USING ERRCODE = '22023';
          END;
          IF v_item_price IS NULL OR v_item_price = 'NaN'::numeric OR
             v_item_price <= 0 OR v_item_price < v_service.price THEN
            RAISE EXCEPTION 'final_service_price_below_minimum' USING ERRCODE = '22023';
          END IF;
        ELSE
          v_item_price := round(v_service.price, 3);
        END IF;

      ELSIF v_item_type = 'product' THEN
        BEGIN
          v_product_id := NULLIF(v_item->>'productId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_product_reference' USING ERRCODE = '22023';
        END;
        SELECT * INTO v_product FROM public.products p
        WHERE p.id = v_product_id AND p.center_id = p_center_id AND p.is_active = true
        FOR UPDATE;
        IF NOT FOUND OR v_product.price <= 0 THEN
          RAISE EXCEPTION 'product_not_available' USING ERRCODE = '23503';
        END IF;
        v_item_name := v_product.name;
        v_item_price := round(v_product.price, 3);

      ELSIF v_item_type = 'package' THEN
        BEGIN
          v_package_id := NULLIF(v_item->>'packageId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_package_reference' USING ERRCODE = '22023';
        END;
        SELECT * INTO v_package FROM public.service_packages p
        WHERE p.id = v_package_id AND p.center_id = p_center_id AND p.is_active = true
        FOR SHARE;
        IF NOT FOUND OR v_package.package_price <= 0 THEN
          RAISE EXCEPTION 'package_not_available' USING ERRCODE = '23503';
        END IF;
        PERFORM 1 FROM public.service_package_items spi WHERE spi.package_id = v_package.id;
        IF NOT FOUND OR EXISTS (
          SELECT 1
          FROM public.service_package_items spi
          LEFT JOIN public.services s ON s.id = spi.service_id
          WHERE spi.package_id = v_package.id
            AND (s.id IS NULL OR s.center_id <> p_center_id OR s.is_active = false)
        ) THEN
          RAISE EXCEPTION 'package_contains_unavailable_service' USING ERRCODE = '23503';
        END IF;
        PERFORM s.id
        FROM public.service_package_items spi
        JOIN public.services s ON s.id = spi.service_id
        WHERE spi.package_id = v_package.id
        FOR SHARE OF s;
        v_item_name := v_package.name;
        v_item_price := round(v_package.package_price, 3);

      ELSE -- gift_card sale line
        v_code := upper(btrim(COALESCE(NULLIF(v_item->>'code', ''), '')));
        IF length(v_code) < 4 THEN
          RAISE EXCEPTION 'gift_card_code_required' USING ERRCODE = '22023';
        END IF;
        IF v_item_qty <> 1 THEN
          RAISE EXCEPTION 'gift_card_quantity_must_be_one' USING ERRCODE = '22023';
        END IF;
        BEGIN
          v_item_price := round(NULLIF(v_item->>'price', '')::numeric, 3);
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'gift_card_value_required' USING ERRCODE = '22023';
        END;
        IF v_item_price IS NULL OR v_item_price = 'NaN'::numeric OR v_item_price <= 0 THEN
          RAISE EXCEPTION 'gift_card_value_required' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_gift_card
        FROM public.gift_cards gc
        WHERE gc.center_id = p_center_id AND gc.code = v_code
        FOR UPDATE;
        IF FOUND THEN
          RAISE EXCEPTION 'gift_card_code_already_exists' USING ERRCODE = '23505';
        END IF;
        BEGIN
          SELECT NULLIF(v_item->>'expiresAtISO', '')::timestamptz INTO v_gift_card.expires_at;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_gift_card_expiry' USING ERRCODE = '22023';
        END;
        INSERT INTO public.gift_cards (
          center_id, code, initial_balance, current_balance,
          customer_id, note, expires_at, is_active
        ) VALUES (
          p_center_id, v_code, v_item_price, v_item_price,
          p_customer_id, NULLIF(btrim(COALESCE(v_item->>'note', '')), ''),
          v_gift_card.expires_at, true
        )
        RETURNING * INTO v_gift_card;
        v_item_name := 'Gift Card ' || v_code;
        v_issued_cards := v_issued_cards || jsonb_build_array(jsonb_build_object(
          'code', v_code, 'gift_card_id', v_gift_card.id, 'value', v_item_price
        ));
      END IF;

      IF v_item_price IS NULL OR v_item_price <= 0 OR length(btrim(COALESCE(v_item_name, ''))) = 0 THEN
        RAISE EXCEPTION 'invalid_canonical_checkout_line' USING ERRCODE = '23514';
      END IF;

      v_subtotal := round(v_subtotal + (v_item_price * v_item_qty), 3);
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'type', v_item_type, 'name', v_item_name, 'qty', v_item_qty,
        'price', v_item_price, 'serviceId', v_service_id,
        'productId', v_product_id, 'packageId', v_package_id, 'code', v_code
      ));
    END LOOP;

    IF v_subtotal <= 0 THEN
      RAISE EXCEPTION 'checkout_subtotal_must_be_positive' USING ERRCODE = '23514';
    END IF;

    SELECT greatest(0, COALESCE(cs.tax_rate, 0)) INTO v_tax_rate
    FROM public.center_settings cs WHERE cs.center_id = p_center_id;
    v_tax_rate := COALESCE(v_tax_rate, 0);

    v_tier_percent := CASE
      WHEN COALESCE(v_customer.total_spent, 0) >= 1000 THEN 15
      WHEN COALESCE(v_customer.total_spent, 0) >= 500 THEN 10
      WHEN COALESCE(v_customer.total_spent, 0) >= 200 THEN 5
      ELSE 0
    END;
    v_tier_discount := round(v_subtotal * v_tier_percent / 100.0, 3);

    IF v_manual_discount + v_tier_discount > v_subtotal THEN
      RAISE EXCEPTION 'discount_exceeds_subtotal' USING ERRCODE = '22023';
    END IF;

    IF COALESCE(p_use_loyalty_points, false) THEN
      v_loyalty_discount := least(
        floor(greatest(v_subtotal - v_manual_discount - v_tier_discount, 0)),
        greatest(COALESCE(v_customer.loyalty_points, 0), 0)
      );
    END IF;

    v_payable := round(greatest(
      v_subtotal - v_manual_discount - v_tier_discount - v_loyalty_discount, 0
    ), 3);

    -- Gift card redemption by code (legacy bearer flow).
    IF v_gift_code IS NOT NULL THEN
      SELECT * INTO v_gift_card
      FROM public.gift_cards gc
      WHERE gc.center_id = p_center_id
        AND gc.code = v_gift_code
        AND gc.is_active = true
        AND (gc.expires_at IS NULL OR gc.expires_at >= now())
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'gift_card_not_available' USING ERRCODE = '23503';
      END IF;
      v_redeem_card_id := v_gift_card.id;

      SELECT * INTO v_entitlement
      FROM public.customer_entitlements ce
      WHERE ce.gift_card_id = v_gift_card.id
      FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO public.customer_entitlements (
          center_id, customer_id, kind, gift_card_id,
          original_value, remaining_value, status, expires_at, legacy_flag
        ) VALUES (
          p_center_id, NULL, 'GIFT_CARD', v_gift_card.id,
          v_gift_card.current_balance, v_gift_card.current_balance, 'ACTIVE',
          v_gift_card.expires_at, true
        )
        RETURNING * INTO v_entitlement;
        INSERT INTO public.entitlement_ledger (
          center_id, entitlement_id, entry_type, amount, legacy_flag, reason
        ) VALUES (
          p_center_id, v_entitlement.id, 'ISSUE', v_gift_card.current_balance,
          true, 'Defensive legacy opening balance for pre-migration gift card.'
        );
      END IF;

      IF v_entitlement.status IN ('FULLY_REDEEMED', 'REFUNDED', 'VOID', 'EXPIRED') THEN
        RAISE EXCEPTION 'gift_card_not_available' USING ERRCODE = '23503';
      END IF;
      IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < now() THEN
        RAISE EXCEPTION 'gift_card_expired' USING ERRCODE = '23514';
      END IF;

      v_gift_card_discount := round(least(
        v_payable,
        greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
      ), 3);

      IF v_gift_card_discount > 0 THEN
        v_redeemed_ids := array_append(v_redeemed_ids, v_entitlement.id::text);
      END IF;
    END IF;

    -- Entitlement redemptions (owned instruments).
    IF p_entitlement_redemptions IS NOT NULL THEN
      FOR v_redemption IN SELECT value FROM jsonb_array_elements(p_entitlement_redemptions)
      LOOP
        IF jsonb_typeof(v_redemption) <> 'object' THEN
          RAISE EXCEPTION 'invalid_entitlement_redemption' USING ERRCODE = '22023';
        END IF;
        v_redemption_type := v_redemption->>'type';
        BEGIN
          v_ent_id := NULLIF(v_redemption->>'entitlementId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_entitlement_reference' USING ERRCODE = '22023';
        END;
        IF v_ent_id IS NULL THEN
          RAISE EXCEPTION 'invalid_entitlement_reference' USING ERRCODE = '22023';
        END IF;
        IF v_ent_id::text = ANY(v_redeemed_ids) THEN
          RAISE EXCEPTION 'entitlement_already_redeemed_on_invoice' USING ERRCODE = '23505';
        END IF;

        SELECT * INTO v_entitlement
        FROM public.customer_entitlements ce
        WHERE ce.id = v_ent_id AND ce.center_id = p_center_id
        FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'entitlement_not_available' USING ERRCODE = '23503';
        END IF;
        IF v_entitlement.customer_id IS DISTINCT FROM p_customer_id THEN
          RAISE EXCEPTION 'entitlement_customer_mismatch' USING ERRCODE = '42501';
        END IF;
        IF v_entitlement.status IN ('FULLY_REDEEMED', 'REFUNDED', 'VOID', 'EXPIRED') THEN
          RAISE EXCEPTION 'entitlement_not_redeemable' USING ERRCODE = '23514';
        END IF;
        IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < now() THEN
          RAISE EXCEPTION 'entitlement_expired' USING ERRCODE = '23514';
        END IF;
        IF v_entitlement.kind = 'GIFT_CARD' AND v_entitlement.gift_card_id IS NOT NULL THEN
          PERFORM 1 FROM public.gift_cards gc
          WHERE gc.id = v_entitlement.gift_card_id AND gc.is_active = true;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'gift_card_not_available' USING ERRCODE = '23503';
          END IF;
        END IF;

        v_ent_amount := 0.000;
        v_ent_service_id := NULL;
        v_ent_units := NULL;

        IF v_redemption_type = 'value' THEN
          IF v_entitlement.kind <> 'GIFT_CARD' THEN
            RAISE EXCEPTION 'value_redemption_requires_gift_card' USING ERRCODE = '22023';
          END IF;
          BEGIN
            v_ent_amount := round(NULLIF(v_redemption->>'amount', '')::numeric, 3);
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'invalid_redemption_amount' USING ERRCODE = '22023';
          END;
          IF v_ent_amount IS NULL OR v_ent_amount = 'NaN'::numeric OR v_ent_amount <= 0 THEN
            RAISE EXCEPTION 'invalid_redemption_amount' USING ERRCODE = '22023';
          END IF;
          v_covered := round(least(
            greatest(v_payable - v_gift_card_discount - v_entitlement_redemption, 0),
            v_ent_amount,
            greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
          ), 3);

        ELSIF v_redemption_type = 'units' THEN
          IF v_entitlement.kind <> 'PACKAGE' THEN
            RAISE EXCEPTION 'units_redemption_requires_package' USING ERRCODE = '22023';
          END IF;
          BEGIN
            v_ent_service_id := NULLIF(v_redemption->>'serviceId', '')::uuid;
            v_ent_units := NULLIF(v_redemption->>'units', '')::integer;
          EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'invalid_package_redemption' USING ERRCODE = '22023';
          END;
          IF v_ent_service_id IS NULL OR v_ent_units IS NULL OR v_ent_units <= 0 THEN
            RAISE EXCEPTION 'invalid_package_redemption' USING ERRCODE = '22023';
          END IF;

          SELECT COALESCE(SUM((l->>'price')::numeric * (l->>'qty')::numeric), 0),
                 COALESCE(SUM((l->>'qty')::integer), 0)
          INTO v_line_value, v_line_qty
          FROM jsonb_array_elements(v_lines) l
          WHERE l->>'type' = 'service' AND l->>'serviceId' = v_ent_service_id::text;
          IF v_line_qty <= 0 THEN
            RAISE EXCEPTION 'package_service_not_on_invoice' USING ERRCODE = '22023';
          END IF;
          IF v_ent_units > v_line_qty THEN
            RAISE EXCEPTION 'package_redemption_exceeds_invoice_quantity' USING ERRCODE = '22023';
          END IF;

          SELECT COALESCE(SUM(peu.total_units), 0), COALESCE(SUM(peu.total_units - peu.used_units), 0)
          INTO v_total_units_all, v_remaining_units_all
          FROM public.package_entitlement_units peu
          WHERE peu.entitlement_id = v_ent_id;
          IF v_ent_units > v_remaining_units_all THEN
            RAISE EXCEPTION 'package_insufficient_units' USING ERRCODE = '23514';
          END IF;

          v_avg_unit_price := round(v_line_value / v_line_qty, 3);
          v_covered := round(least(
            greatest(v_payable - v_gift_card_discount - v_entitlement_redemption, 0),
            round(v_avg_unit_price * v_ent_units, 3),
            greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
          ), 3);
          IF v_ent_units >= v_remaining_units_all THEN
            v_covered := round(least(
              greatest(v_payable - v_gift_card_discount - v_entitlement_redemption, 0),
              greatest(COALESCE(v_entitlement.remaining_value, 0), 0)
            ), 3);
          END IF;

        ELSE
          RAISE EXCEPTION 'invalid_entitlement_redemption_type' USING ERRCODE = '22023';
        END IF;

        IF v_covered <= 0 THEN
          RAISE EXCEPTION 'entitlement_insufficient_balance' USING ERRCODE = '23514';
        END IF;

        v_entitlement_redemption := round(v_entitlement_redemption + v_covered, 3);
        v_redeemed_ids := array_append(v_redeemed_ids, v_ent_id::text);
        v_redemptions := v_redemptions || jsonb_build_array(jsonb_build_object(
          'entitlement_id', v_ent_id, 'type', v_redemption_type,
          'amount', v_covered, 'service_id', v_ent_service_id, 'units', v_ent_units
        ));
      END LOOP;
    END IF;

    v_net := round(greatest(
      v_payable - v_gift_card_discount - v_entitlement_redemption, 0
    ), 3);
    v_tax_amount := round(v_net * v_tax_rate / 100.0, 3);
    v_total := round(v_net + v_tax_amount, 3);
    v_earned_points := floor(v_net)::integer;

    -- --- Split tenders + tips + full-balance enforcement --------------------
    v_tenders_sum := 0.000;
    v_tips_total := 0.000;
    v_tender_count := 0;
    v_single_method := NULL;

    IF p_payments IS NOT NULL THEN
      IF jsonb_typeof(p_payments) <> 'array' THEN
        RAISE EXCEPTION 'invalid_payments' USING ERRCODE = '22023';
      END IF;
      FOR v_tender IN SELECT value FROM jsonb_array_elements(p_payments)
      LOOP
        v_tender_method := lower(btrim(COALESCE(v_tender->>'method', '')));
        BEGIN
          v_tender_amount := round(NULLIF(v_tender->>'amount', '')::numeric, 3);
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_tender_amount' USING ERRCODE = '22023';
        END;
        BEGIN
          v_tender_tip := round(COALESCE(NULLIF(v_tender->>'tip', '')::numeric, 0), 3);
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'invalid_tender_tip' USING ERRCODE = '22023';
        END;

        IF v_tender_method NOT IN ('cash', 'card', 'transfer') THEN
          RAISE EXCEPTION 'unsupported_payment_method' USING ERRCODE = '22023';
        END IF;
        IF v_tender_amount IS NULL OR v_tender_amount = 'NaN'::numeric OR v_tender_amount <= 0 THEN
          RAISE EXCEPTION 'invalid_tender_amount' USING ERRCODE = '22023';
        END IF;
        IF v_tender_tip IS NULL OR v_tender_tip = 'NaN'::numeric OR v_tender_tip < 0 THEN
          RAISE EXCEPTION 'invalid_tender_tip' USING ERRCODE = '22023';
        END IF;

        v_tenders_sum := round(v_tenders_sum + v_tender_amount, 3);
        v_tips_total := round(v_tips_total + v_tender_tip, 3);
        v_tender_count := v_tender_count + 1;
        v_single_method := v_tender_method;
      END LOOP;
    ELSIF v_total > 0 THEN
      IF p_payment_method IS NULL OR lower(btrim(p_payment_method)) NOT IN ('cash', 'card', 'transfer') THEN
        RAISE EXCEPTION 'unsupported_payment_method' USING ERRCODE = '22023';
      END IF;
      v_tender_method := lower(btrim(p_payment_method));
      v_tenders_sum := v_total;
      v_tender_count := 1;
      v_single_method := v_tender_method;
    END IF;

    IF v_total > 0 AND v_tender_count = 0 THEN
      RAISE EXCEPTION 'payments_required' USING ERRCODE = '22023';
    END IF;
    IF abs(v_tenders_sum - v_total) > 0.0005 THEN
      RAISE EXCEPTION 'payments_do_not_cover_total' USING ERRCODE = '23514';
    END IF;
    IF v_total = 0 AND v_tips_total > 0 THEN
      RAISE EXCEPTION 'tip_requires_payment' USING ERRCODE = '22023';
    END IF;

    v_invoice_method := CASE
      WHEN v_tender_count = 0 THEN 'cash'
      WHEN v_tender_count = 1 THEN v_single_method
      ELSE 'split'
    END;

    INSERT INTO public.invoices (
      center_id, customer_id, employee_id, appointment_id, serial_number,
      payment_method, subtotal_amount, manual_discount, tier_discount,
      loyalty_discount, gift_card_discount, entitlement_redemption, discount,
      loyalty_points_used, tax_rate, tax, total_amount, amount_paid, status,
      tips_amount, cogs_amount
    ) VALUES (
      p_center_id, p_customer_id, p_employee_id, p_appointment_id,
      'INV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_invoice_method,
      v_subtotal, v_manual_discount, v_tier_discount, v_loyalty_discount,
      v_gift_card_discount, v_entitlement_redemption,
      round(v_manual_discount + v_tier_discount + v_gift_card_discount
            + v_entitlement_redemption, 3),
      v_loyalty_discount::integer, v_tax_rate, v_tax_amount,
      v_total, v_total, 'PAID', v_tips_total, 0
    ) RETURNING id INTO v_invoice_id;

    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
    LOOP
      v_item_type := v_line->>'type';
      v_item_name := v_line->>'name';
      v_item_qty := (v_line->>'qty')::numeric;
      v_item_price := (v_line->>'price')::numeric;
      v_service_id := NULLIF(v_line->>'serviceId', '')::uuid;
      v_product_id := NULLIF(v_line->>'productId', '')::uuid;
      v_package_id := NULLIF(v_line->>'packageId', '')::uuid;
      v_code := NULLIF(v_line->>'code', '');
      v_gift_card.id := NULL;

      IF v_item_type = 'gift_card' AND v_code IS NOT NULL THEN
        SELECT gc.id INTO v_gift_card.id
        FROM public.gift_cards gc
        WHERE gc.center_id = p_center_id AND gc.code = v_code;
      END IF;

      INSERT INTO public.invoice_items (
        invoice_id, service_id, product_id, package_id, gift_card_id,
        item_type, item_name, price, quantity
      ) VALUES (
        v_invoice_id, v_service_id, v_product_id, v_package_id, v_gift_card.id,
        v_item_type, v_item_name, v_item_price, v_item_qty::integer
      );

      IF v_item_type = 'product' THEN
        UPDATE public.products p
        SET stock_quantity = p.stock_quantity - v_item_qty::integer
        WHERE p.id = v_product_id
          AND p.center_id = p_center_id
          AND p.is_active = true
          AND p.track_inventory = true
          AND p.stock_quantity >= v_item_qty::integer;
        IF NOT FOUND THEN
          PERFORM 1 FROM public.products p
          WHERE p.id = v_product_id
            AND p.center_id = p_center_id
            AND p.is_active = true
            AND p.track_inventory = false;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'insufficient_or_unavailable_product_stock' USING ERRCODE = '23514';
          END IF;
        END IF;
      END IF;

      -- Service BOM consumption (dyes / oils / materials) + COGS.
      IF v_item_type = 'service' AND v_service_id IS NOT NULL THEN
        FOR v_bom_row IN
          SELECT * FROM public.service_bom_items sb
          WHERE sb.service_id = v_service_id AND sb.center_id = p_center_id
        LOOP
          v_consumed := v_bom_row.quantity_used * v_item_qty::integer;

          SELECT * INTO v_material
          FROM public.products p
          WHERE p.id = v_bom_row.product_id AND p.center_id = p_center_id
          FOR UPDATE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'bom_material_not_available' USING ERRCODE = '23503';
          END IF;

          IF v_material.track_inventory THEN
            UPDATE public.products p
            SET stock_quantity = p.stock_quantity - v_consumed
            WHERE p.id = v_bom_row.product_id
              AND p.center_id = p_center_id
              AND p.stock_quantity >= v_consumed;
            IF NOT FOUND THEN
              RAISE EXCEPTION 'insufficient_bom_material_stock' USING ERRCODE = '23514';
            END IF;
          END IF;

          INSERT INTO public.service_material_usage (
            center_id, invoice_id, appointment_id, service_id, product_id,
            quantity_used, unit_cost, cogs
          ) VALUES (
            p_center_id, v_invoice_id, p_appointment_id, v_service_id,
            v_bom_row.product_id, v_consumed, v_material.cost,
            round(v_consumed * v_material.cost, 3)
          );

          v_cogs_total := round(v_cogs_total + (v_consumed * v_material.cost), 3);
        END LOOP;
      END IF;
    END LOOP;

    IF v_cogs_total > 0 THEN
      UPDATE public.invoices SET cogs_amount = v_cogs_total WHERE id = v_invoice_id;
    END IF;

    -- --- Entitlement creation for sold gift cards ----------------------------
    FOR v_issued_card IN SELECT value FROM jsonb_array_elements(v_issued_cards)
    LOOP
      INSERT INTO public.customer_entitlements (
        center_id, customer_id, kind, gift_card_id, source_invoice_id,
        original_value, remaining_value, status, expires_at, legacy_flag
      ) VALUES (
        p_center_id, p_customer_id, 'GIFT_CARD',
        (v_issued_card->>'gift_card_id')::uuid, v_invoice_id,
        (v_issued_card->>'value')::numeric, (v_issued_card->>'value')::numeric,
        'ACTIVE',
        (SELECT expires_at FROM public.gift_cards gc WHERE gc.id = (v_issued_card->>'gift_card_id')::uuid),
        false
      )
      RETURNING * INTO v_entitlement;

      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, v_entitlement.id, 'ISSUE',
        (v_issued_card->>'value')::numeric, v_invoice_id, p_employee_id,
        'Gift card sold at checkout'
      );
    END LOOP;

    -- --- Entitlement creation for sold packages ------------------------------
    FOR v_line IN SELECT value FROM jsonb_array_elements(v_lines)
    LOOP
      IF v_line->>'type' <> 'package' THEN
        CONTINUE;
      END IF;
      v_package_id := NULLIF(v_line->>'packageId', '')::uuid;
      v_item_price := (v_line->>'price')::numeric;
      v_item_qty := (v_line->>'qty')::numeric;

      INSERT INTO public.customer_entitlements (
        center_id, customer_id, kind, package_id, source_invoice_id,
        original_value, remaining_value, status, legacy_flag
      ) VALUES (
        p_center_id, p_customer_id, 'PACKAGE', v_package_id, v_invoice_id,
        round(v_item_price * v_item_qty, 3), round(v_item_price * v_item_qty, 3),
        'ACTIVE', false
      )
      RETURNING * INTO v_package_entitlement;

      FOR v_unit_row IN
        SELECT * FROM public.service_package_items spi
        WHERE spi.package_id = v_package_id
      LOOP
        INSERT INTO public.package_entitlement_units (
          center_id, entitlement_id, service_id, total_units, used_units
        ) VALUES (
          p_center_id, v_package_entitlement.id, v_unit_row.service_id,
          v_unit_row.quantity * v_item_qty::integer, 0
        );
      END LOOP;

      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, v_package_entitlement.id, 'ISSUE',
        round(v_item_price * v_item_qty, 3), v_invoice_id, p_employee_id,
        'Package sold at checkout'
      );

      v_package_ents := v_package_ents || jsonb_build_array(v_package_entitlement.id);
    END LOOP;

    -- --- Payments (split tenders + tips) -------------------------------------
    IF p_payments IS NOT NULL THEN
      FOR v_tender IN SELECT value FROM jsonb_array_elements(p_payments)
      LOOP
        v_tender_method := lower(btrim(COALESCE(v_tender->>'method', '')));
        v_tender_amount := round(NULLIF(v_tender->>'amount', '')::numeric, 3);
        v_tender_tip := round(COALESCE(NULLIF(v_tender->>'tip', '')::numeric, 0), 3);
        INSERT INTO public.payments (center_id, invoice_id, amount, method, status, tip)
        VALUES (p_center_id, v_invoice_id, v_tender_amount, v_tender_method, 'SUCCEEDED', v_tender_tip)
        RETURNING * INTO v_payment;
        v_payment_rows := v_payment_rows || jsonb_build_array(to_jsonb(v_payment));
      END LOOP;
    ELSIF v_total > 0 THEN
      INSERT INTO public.payments (center_id, invoice_id, amount, method, status, tip)
      VALUES (p_center_id, v_invoice_id, v_total, v_single_method, 'SUCCEEDED', 0)
      RETURNING * INTO v_payment;
      v_payment_rows := v_payment_rows || jsonb_build_array(to_jsonb(v_payment));
    END IF;

    -- --- Ledger entries for redemptions --------------------------------------
    IF v_gift_card_discount > 0 AND v_gift_code IS NOT NULL THEN
      SELECT id INTO v_ent_id
      FROM public.customer_entitlements ce
      WHERE ce.gift_card_id = v_redeem_card_id;
      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, v_ent_id, 'REDEEM', v_gift_card_discount, v_invoice_id,
        p_employee_id, 'Gift card redeemed at checkout'
      );
    END IF;

    FOR v_redemption IN SELECT value FROM jsonb_array_elements(v_redemptions)
    LOOP
      INSERT INTO public.entitlement_ledger (
        center_id, entitlement_id, entry_type, amount, units, service_id,
        invoice_id, actor_id, reason
      ) VALUES (
        p_center_id, (v_redemption->>'entitlement_id')::uuid, 'REDEEM',
        (v_redemption->>'amount')::numeric,
        NULLIF(v_redemption->>'units', '')::integer,
        NULLIF(v_redemption->>'service_id', '')::uuid,
        v_invoice_id, p_employee_id, 'Entitlement redeemed at checkout'
      );
    END LOOP;

    -- --- Commission accrual (net paid service revenue) -----------------------
    v_commission := app_private.accrue_invoice_commission_v1(v_invoice_id);

    UPDATE public.customers c
    SET total_spent = COALESCE(c.total_spent, 0) + v_net,
        loyalty_points = greatest(0, COALESCE(c.loyalty_points, 0) - v_loyalty_discount::integer)
          + v_earned_points,
        last_visit = now(),
        updated_at = now()
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;

    SELECT to_jsonb(i) INTO v_updated_invoice
    FROM public.invoices i WHERE i.id = v_invoice_id;

    RETURN jsonb_build_object(
      'invoice', v_updated_invoice,
      'payments', v_payment_rows,
      'subtotal', v_subtotal,
      'manual_discount', v_manual_discount,
      'tier_discount', v_tier_discount,
      'loyalty_discount', v_loyalty_discount,
      'gift_card_redeemed', v_gift_card_discount,
      'entitlement_redeemed', v_entitlement_redemption,
      'tax', v_tax_amount,
      'total', v_total,
      'tips', v_tips_total,
      'cogs', v_cogs_total,
      'commission', v_commission,
      'earned', v_earned_points,
      'gift_cards_issued', v_issued_cards,
      'package_entitlements', v_package_ents
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Service execution: complete an appointment atomically
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_appointment_v1(
  p_center_id               UUID,
  p_appointment_id          UUID,
  p_payment_method          TEXT DEFAULT 'cash',
  p_discount_amount         NUMERIC DEFAULT 0,
  p_use_loyalty_points      BOOLEAN DEFAULT false,
  p_gift_card_code          TEXT DEFAULT NULL,
  p_entitlement_redemptions JSONB DEFAULT NULL,
  p_payments                JSONB DEFAULT NULL,
  p_final_price             NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_service     public.services%ROWTYPE;
  v_price       NUMERIC(12,3);
  v_items       JSONB;
  v_checkout    JSONB;
  v_updated     public.appointments%ROWTYPE;
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'unauthorized_service_execution' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id AND a.center_id = p_center_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '23503';
  END IF;

  IF v_appointment.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'appointment_not_completable' USING ERRCODE = '23514';
  END IF;
  IF v_appointment.service_id IS NULL THEN
    RAISE EXCEPTION 'appointment_service_missing' USING ERRCODE = '23502';
  END IF;

  SELECT * INTO v_service
  FROM public.services s
  WHERE s.id = v_appointment.service_id AND s.center_id = p_center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_service_not_available' USING ERRCODE = '23503';
  END IF;

  IF v_service.pricing_mode = 'STARTING_FROM' THEN
    IF p_final_price IS NULL OR p_final_price = 'NaN'::numeric OR
       p_final_price < v_service.price THEN
      RAISE EXCEPTION 'final_service_price_required' USING ERRCODE = '22023';
    END IF;
    v_price := round(p_final_price, 3);
  ELSE
    v_price := round(v_service.price, 3);
  END IF;

  v_items := jsonb_build_array(jsonb_build_object(
    'type', 'service',
    'serviceId', v_appointment.service_id,
    'qty', 1,
    'price', v_price
  ));

  v_checkout := public.process_checkout_v2(
    p_center_id,
    v_appointment.customer_id,
    COALESCE(v_appointment.employee_id, (SELECT id FROM public.employees WHERE center_id = p_center_id AND is_active = true LIMIT 1)),
    p_payment_method,
    p_discount_amount,
    p_use_loyalty_points,
    v_items,
    p_gift_card_code,
    p_entitlement_redemptions,
    p_payments,
    v_appointment.id
  );

  UPDATE public.appointments a
  SET status = 'COMPLETED', updated_at = now()
  WHERE a.id = v_appointment.id AND a.status = 'SCHEDULED'
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_status_changed' USING ERRCODE = '23514';
  END IF;

  RETURN jsonb_build_object(
    'appointment', to_jsonb(v_updated),
    'checkout', v_checkout
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Grants
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.set_service_bom_v1(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_service_bom_v1(UUID, UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_service_bom_v1(UUID, UUID, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.process_checkout_v2(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_checkout_v2(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB, JSONB, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_checkout_v2(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT, JSONB, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_appointment_v1(UUID, UUID, TEXT, NUMERIC, BOOLEAN, TEXT, JSONB, JSONB, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_appointment_v1(UUID, UUID, TEXT, NUMERIC, BOOLEAN, TEXT, JSONB, JSONB, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_appointment_v1(UUID, UUID, TEXT, NUMERIC, BOOLEAN, TEXT, JSONB, JSONB, NUMERIC) TO authenticated;

COMMIT;

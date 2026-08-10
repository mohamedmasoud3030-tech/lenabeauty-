-- =============================================================================
-- LenaBeauty phase 3 — operational data integrity and canonical checkout
-- =============================================================================
-- Additive, production-safe DDL only: this migration does not seed or rewrite
-- production business rows. Existing rows are left in place; NOT VALID checks
-- enforce every future INSERT/UPDATE without failing on unknown legacy data.
--
-- Canonical financial formula (OMR, 3 decimal places):
--   subtotal = sum(authoritative unit_price * integer quantity)
--   net      = subtotal - manual - tier - whole-point loyalty - gift card
--   tax      = round(net * tax_rate / 100, 3)
--   total    = net + tax
--
-- Fixed service, product, and package prices are resolved from the database.
-- Only STARTING_FROM services accept an operator-supplied final price, and that
-- price must be positive and >= the catalog minimum.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Real service categories and explicit pricing semantics
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_categories_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT service_categories_center_name_unique UNIQUE (center_id, name)
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_member ON public.service_categories;
CREATE POLICY service_categories_member ON public.service_categories
  FOR ALL TO authenticated
  USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
REVOKE ALL ON public.service_categories FROM anon;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS catalog_code TEXT;

DO $$ BEGIN
  ALTER TABLE public.services
    ADD CONSTRAINT services_category_fk
    FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.services
    ADD CONSTRAINT services_category_required CHECK (category_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.services
    ADD CONSTRAINT services_pricing_mode_valid
    CHECK (pricing_mode IN ('FIXED', 'STARTING_FROM')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.services
    ADD CONSTRAINT services_sell_price_positive CHECK (price > 0 AND price <> 'NaN'::numeric) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_services_center_catalog_code
  ON public.services(center_id, catalog_code)
  WHERE catalog_code IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Product availability and stock-tracking semantics
-- -----------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_sell_price_positive CHECK (price > 0 AND price <> 'NaN'::numeric) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.service_packages
    ADD CONSTRAINT service_packages_sell_price_positive
    CHECK (package_price > 0 AND package_price <> 'NaN'::numeric) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 3. Immutable sale snapshots, explicit invoice breakdown, and payments
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS item_name TEXT;

DO $$ BEGIN
  ALTER TABLE public.invoice_items
    ADD CONSTRAINT invoice_items_type_valid
    CHECK (item_type IN ('service', 'product', 'package')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoice_items
    ADD CONSTRAINT invoice_items_name_not_blank
    CHECK (length(btrim(item_name)) > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoice_items
    ADD CONSTRAINT invoice_items_one_catalog_reference
    CHECK (num_nonnulls(service_id, product_id, package_id) = 1) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoice_items
    ADD CONSTRAINT invoice_items_positive_line
    CHECK (price > 0 AND price <> 'NaN'::numeric AND quantity > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_discount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier_discount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_card_discount NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PAID';

DO $$ BEGIN
  ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_status_valid CHECK (status IN ('PAID', 'VOID')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_breakdown_non_negative CHECK (
      subtotal_amount >= 0 AND subtotal_amount <> 'NaN'::numeric AND
      manual_discount >= 0 AND manual_discount <> 'NaN'::numeric AND
      tier_discount >= 0 AND tier_discount <> 'NaN'::numeric AND
      loyalty_discount >= 0 AND loyalty_discount <> 'NaN'::numeric AND
      gift_card_discount >= 0 AND gift_card_discount <> 'NaN'::numeric AND
      tax_rate BETWEEN 0 AND 100 AND tax_rate <> 'NaN'::numeric AND
      amount_paid >= 0 AND amount_paid <> 'NaN'::numeric
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_paid_totals_consistent CHECK (
      status <> 'PAID' OR (
        discount = round(manual_discount + tier_discount + gift_card_discount, 3) AND
        tax = round(
          greatest(subtotal_amount - manual_discount - tier_discount - loyalty_discount - gift_card_discount, 0)
          * tax_rate / 100.0,
          3
        ) AND
        total_amount = round(
          greatest(subtotal_amount - manual_discount - tier_discount - loyalty_discount - gift_card_discount, 0) + tax,
          3
        ) AND
        amount_paid = total_amount
      )
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_id_center_unique
  ON public.invoices(id, center_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE RESTRICT,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(12,3) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  CONSTRAINT payments_method_valid CHECK (method IN ('cash', 'card', 'transfer')),
  CONSTRAINT payments_status_valid CHECK (status IN ('SUCCEEDED', 'FAILED', 'REFUNDED'))
);

DO $$ BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_invoice_center_fk
    FOREIGN KEY (invoice_id, center_id)
    REFERENCES public.invoices(id, center_id) ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_payments_center_created
  ON public.payments(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON public.payments(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_success_per_invoice
  ON public.payments(invoice_id) WHERE status = 'SUCCEEDED';

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_member_select ON public.payments;
CREATE POLICY payments_member_select ON public.payments
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

GRANT SELECT ON public.payments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;

-- Financial rows are created only by the membership-gated SECURITY DEFINER
-- checkout. This closes the proven direct-write integrity gap while preserving
-- member reads for POS receipts, Sales, Dashboard, and Reports.
DROP POLICY IF EXISTS invoices_tenant ON public.invoices;
DROP POLICY IF EXISTS invoices_member_select ON public.invoices;
CREATE POLICY invoices_member_select ON public.invoices
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS invoice_items_tenant ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_member_select ON public.invoice_items;
CREATE POLICY invoice_items_member_select ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND app_private.is_center_member(i.center_id)
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoice_items FROM anon, authenticated;
GRANT SELECT ON public.invoices, public.invoice_items TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. Appointment relationship and state-machine integrity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_private.enforce_appointment_integrity_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, app_private
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW') THEN
      RAISE EXCEPTION 'terminal_appointment_cannot_be_deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status <> 'SCHEDULED' THEN
    RAISE EXCEPTION 'new_appointment_must_be_scheduled' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('COMPLETED', 'CANCELLED', 'NO_SHOW') AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'terminal_appointment_cannot_be_changed' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'SCHEDULED' AND NEW.status NOT IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') THEN
      RAISE EXCEPTION 'invalid_appointment_status_transition' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.customer_id IS NULL OR NEW.employee_id IS NULL OR NEW.service_id IS NULL OR NEW.date_time IS NULL THEN
    RAISE EXCEPTION 'appointment_customer_service_staff_time_required' USING ERRCODE = '23502';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = NEW.customer_id AND c.center_id = NEW.center_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_customer_wrong_center' USING ERRCODE = '23503';
  END IF;

  PERFORM 1 FROM public.employees e
  WHERE e.id = NEW.employee_id
    AND e.center_id = NEW.center_id
    AND (NEW.status <> 'SCHEDULED' OR e.is_active = true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_employee_not_available' USING ERRCODE = '23503';
  END IF;

  PERFORM 1 FROM public.services s
  WHERE s.id = NEW.service_id
    AND s.center_id = NEW.center_id
    AND (NEW.status <> 'SCHEDULED' OR s.is_active = true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment_service_not_available' USING ERRCODE = '23503';
  END IF;

  IF NEW.status = 'SCHEDULED' THEN
    PERFORM 1 FROM public.appointments a
    WHERE a.center_id = NEW.center_id
      AND a.employee_id = NEW.employee_id
      AND a.status = 'SCHEDULED'
      AND a.date_time = NEW.date_time
      AND a.id <> NEW.id;
    IF FOUND THEN
      RAISE EXCEPTION 'appointment_staff_time_conflict' USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_appointment_integrity_v1 ON public.appointments;
CREATE TRIGGER enforce_appointment_integrity_v1
BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION app_private.enforce_appointment_integrity_v1();

DO $$ BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_operational_relationships_required
    CHECK (status NOT IN ('SCHEDULED', 'COMPLETED') OR
           (customer_id IS NOT NULL AND employee_id IS NOT NULL AND service_id IS NOT NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- 5. Canonical atomic checkout
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_checkout_v1(
    p_center_id          UUID,
    p_customer_id        UUID,
    p_employee_id        UUID,
    p_payment_method     TEXT,
    p_discount_amount    NUMERIC,
    p_use_loyalty_points BOOLEAN,
    p_items              JSONB,
    p_gift_card_code     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, app_private
AS $$
DECLARE
    v_invoice_id          UUID;
    v_payment_id          UUID;
    v_subtotal            NUMERIC(12,3) := 0.000;
    v_net                 NUMERIC(12,3) := 0.000;
    v_tax_rate            NUMERIC(5,2) := 0.000;
    v_tax_amount          NUMERIC(12,3) := 0.000;
    v_total               NUMERIC(12,3) := 0.000;
    v_manual_discount     NUMERIC(12,3) := 0.000;
    v_tier_percent        NUMERIC(5,2) := 0.000;
    v_tier_discount       NUMERIC(12,3) := 0.000;
    v_loyalty_discount    NUMERIC(12,3) := 0.000;
    v_gift_card_discount  NUMERIC(12,3) := 0.000;
    v_earned_points       INTEGER := 0;
    v_item                JSONB;
    v_line                JSONB;
    v_lines               JSONB := '[]'::jsonb;
    v_item_type           TEXT;
    v_item_name           TEXT;
    v_item_qty            NUMERIC;
    v_item_price          NUMERIC(12,3);
    v_service_id          UUID;
    v_product_id          UUID;
    v_package_id          UUID;
    v_service             public.services%ROWTYPE;
    v_product             public.products%ROWTYPE;
    v_package             public.service_packages%ROWTYPE;
    v_customer            public.customers%ROWTYPE;
    v_gift_card           public.gift_cards%ROWTYPE;
    v_gift_code           TEXT := upper(NULLIF(btrim(COALESCE(p_gift_card_code, '')), ''));
    v_updated_invoice     JSONB;
BEGIN
    IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
      RAISE EXCEPTION 'unauthorized_checkout_center' USING ERRCODE = '42501';
    END IF;

    IF p_payment_method NOT IN ('cash', 'card', 'transfer') THEN
      RAISE EXCEPTION 'unsupported_payment_method' USING ERRCODE = '22023';
    END IF;

    IF p_discount_amount IS NOT NULL AND
       (p_discount_amount = 'NaN'::numeric OR p_discount_amount < 0) THEN
      RAISE EXCEPTION 'invalid_manual_discount' USING ERRCODE = '22023';
    END IF;
    v_manual_discount := round(COALESCE(p_discount_amount, 0), 3);

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'checkout_items_required' USING ERRCODE = '22023';
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

    -- Resolve each submitted reference to an immutable canonical line. Client
    -- prices are ignored except for STARTING_FROM services.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      BEGIN
        v_item_type := v_item->>'type';
        v_item_qty := NULLIF(v_item->>'qty', '')::numeric;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'invalid_checkout_line' USING ERRCODE = '22023';
      END;

      IF v_item_type NOT IN ('service', 'product', 'package') OR
         v_item_qty IS NULL OR v_item_qty = 'NaN'::numeric OR
         v_item_qty <= 0 OR v_item_qty <> trunc(v_item_qty) THEN
        RAISE EXCEPTION 'invalid_checkout_line' USING ERRCODE = '22023';
      END IF;

      v_service_id := NULL;
      v_product_id := NULL;
      v_package_id := NULL;
      v_item_name := NULL;
      v_item_price := NULL;

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

      ELSE
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
        -- Hold component rows stable until the sale commits so a service
        -- cannot be disabled between package validation and invoice creation.
        PERFORM s.id
        FROM public.service_package_items spi
        JOIN public.services s ON s.id = spi.service_id
        WHERE spi.package_id = v_package.id
        FOR SHARE OF s;
        v_item_name := v_package.name;
        v_item_price := round(v_package.package_price, 3);
      END IF;

      IF v_item_price IS NULL OR v_item_price <= 0 OR length(btrim(COALESCE(v_item_name, ''))) = 0 THEN
        RAISE EXCEPTION 'invalid_canonical_checkout_line' USING ERRCODE = '23514';
      END IF;

      v_subtotal := round(v_subtotal + (v_item_price * v_item_qty), 3);
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'type', v_item_type,
        'name', v_item_name,
        'qty', v_item_qty,
        'price', v_item_price,
        'serviceId', v_service_id,
        'productId', v_product_id,
        'packageId', v_package_id
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
      v_gift_card_discount := round(least(
        greatest(v_subtotal - v_manual_discount - v_tier_discount - v_loyalty_discount, 0),
        greatest(COALESCE(v_gift_card.current_balance, 0), 0)
      ), 3);
    END IF;

    v_net := round(greatest(
      v_subtotal - v_manual_discount - v_tier_discount - v_loyalty_discount - v_gift_card_discount,
      0
    ), 3);
    v_tax_amount := round(v_net * v_tax_rate / 100.0, 3);
    v_total := round(v_net + v_tax_amount, 3);
    v_earned_points := floor(v_net)::integer;

    INSERT INTO public.invoices (
      center_id, customer_id, employee_id, serial_number, payment_method,
      subtotal_amount, manual_discount, tier_discount, loyalty_discount,
      gift_card_discount, discount, loyalty_points_used, tax_rate, tax,
      total_amount, amount_paid, status
    ) VALUES (
      p_center_id, p_customer_id, p_employee_id,
      'INV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      p_payment_method,
      v_subtotal, v_manual_discount, v_tier_discount, v_loyalty_discount,
      v_gift_card_discount, round(v_manual_discount + v_tier_discount + v_gift_card_discount, 3),
      v_loyalty_discount::integer, v_tax_rate, v_tax_amount,
      v_total, v_total, 'PAID'
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

      INSERT INTO public.invoice_items (
        invoice_id, service_id, product_id, package_id,
        item_type, item_name, price, quantity
      ) VALUES (
        v_invoice_id, v_service_id, v_product_id, v_package_id,
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
          -- No update is correct for a non-inventory product; otherwise the
          -- product became unavailable or stock was insufficient.
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
    END LOOP;

    IF v_total > 0 THEN
      INSERT INTO public.payments (center_id, invoice_id, amount, method, status)
      VALUES (p_center_id, v_invoice_id, v_total, p_payment_method, 'SUCCEEDED')
      RETURNING id INTO v_payment_id;
    END IF;

    IF v_gift_card_discount > 0 THEN
      UPDATE public.gift_cards gc
      SET current_balance = gc.current_balance - v_gift_card_discount,
          is_active = (gc.current_balance - v_gift_card_discount) > 0,
          updated_at = now()
      WHERE gc.id = v_gift_card.id;

      INSERT INTO public.gift_card_transactions (
        gift_card_id, center_id, kind, amount, invoice_id, note
      ) VALUES (
        v_gift_card.id, p_center_id, 'REDEEMED', v_gift_card_discount,
        v_invoice_id, 'Redeemed during successful checkout'
      );
    END IF;

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
      'payment_id', v_payment_id,
      'subtotal', v_subtotal,
      'manual_discount', v_manual_discount,
      'tier_discount', v_tier_discount,
      'loyalty_discount', v_loyalty_discount,
      'gift_card_redeemed', v_gift_card_discount,
      'tax', v_tax_amount,
      'total', v_total,
      'earned', v_earned_points
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) TO authenticated;

COMMIT;

-- SUPABASE CHECKOUT ACTIVATION (PHASE 10B)
-- Apply after docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql and the staging seed.
-- Enables real POS checkout, invoice serialization, dashboard revenue, and sales reports.

BEGIN;

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    serial_number TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
    total_amount NUMERIC(12, 3) NOT NULL CHECK (total_amount >= 0),
    discount NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (discount >= 0),
    loyalty_points_used NUMERIC(12, 3) NOT NULL DEFAULT 0.000 CHECK (loyalty_points_used >= 0),
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    price NUMERIC(12, 3) NOT NULL CHECK (price >= 0),
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 1.000 CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invoice_items_exactly_one_catalog_ref CHECK (
        (service_id IS NOT NULL AND product_id IS NULL)
        OR (service_id IS NULL AND product_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_invoices_center_date ON public.invoices(center_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_service_id ON public.invoice_items(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view invoices for their centers" ON public.invoices;
CREATE POLICY "Staff view invoices for their centers"
ON public.invoices FOR SELECT
USING (center_id = ANY(app_private.user_center_ids()));

DROP POLICY IF EXISTS "Deny direct invoice inserts" ON public.invoices;
CREATE POLICY "Deny direct invoice inserts"
ON public.invoices FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct invoice updates" ON public.invoices;
CREATE POLICY "Deny direct invoice updates"
ON public.invoices FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct invoice deletes" ON public.invoices;
CREATE POLICY "Deny direct invoice deletes"
ON public.invoices FOR DELETE
USING (false);

DROP POLICY IF EXISTS "Staff view invoice items for their centers" ON public.invoice_items;
CREATE POLICY "Staff view invoice items for their centers"
ON public.invoice_items FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.invoices i
        WHERE i.id = invoice_items.invoice_id
          AND i.center_id = ANY(app_private.user_center_ids())
    )
);

DROP POLICY IF EXISTS "Deny direct invoice item inserts" ON public.invoice_items;
CREATE POLICY "Deny direct invoice item inserts"
ON public.invoice_items FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct invoice item updates" ON public.invoice_items;
CREATE POLICY "Deny direct invoice item updates"
ON public.invoice_items FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct invoice item deletes" ON public.invoice_items;
CREATE POLICY "Deny direct invoice item deletes"
ON public.invoice_items FOR DELETE
USING (false);

CREATE OR REPLACE FUNCTION public.process_checkout_v1(
    p_center_id UUID,
    p_customer_id UUID,
    p_employee_id UUID,
    p_payment_method TEXT,
    p_discount_amount NUMERIC,
    p_use_loyalty_points BOOLEAN,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invoice_id UUID;
    v_total NUMERIC(12, 3) := 0.000;
    v_item JSONB;
    v_item_type TEXT;
    v_item_qty NUMERIC(12, 3);
    v_item_price NUMERIC(12, 3);
    v_service_id UUID;
    v_product_id UUID;
    v_discount NUMERIC(12, 3) := GREATEST(0.000, COALESCE(p_discount_amount, 0.000));
    v_loyalty_discount NUMERIC(12, 3) := 0.000;
    v_earned_points NUMERIC(12, 3) := 0.000;
    v_updated_invoice JSONB;
BEGIN
    IF p_center_id IS NULL OR NOT app_private.has_center_role(
        p_center_id,
        ARRAY[
            'owner'::public.member_role,
            'admin'::public.member_role,
            'manager'::public.member_role,
            'staff'::public.member_role
        ]
    ) THEN
        RAISE EXCEPTION 'Unauthorized checkout center'
            USING ERRCODE = '42501';
    END IF;

    IF p_payment_method NOT IN ('cash', 'card', 'transfer') THEN
        RAISE EXCEPTION 'Unsupported payment method'
            USING ERRCODE = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Checkout items must be a non-empty array'
            USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.center_id = p_center_id
      AND c.deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer is not available for this center'
            USING ERRCODE = '23503';
    END IF;

    IF p_employee_id IS NOT NULL THEN
        PERFORM 1
        FROM public.employees e
        WHERE e.id = p_employee_id
          AND e.center_id = p_center_id
          AND e.deleted_at IS NULL
          AND e.is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Employee is not available for this center'
                USING ERRCODE = '23503';
        END IF;
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_item_type := v_item->>'type';
        v_item_qty := NULLIF(v_item->>'qty', '')::NUMERIC;
        v_item_price := NULLIF(v_item->>'price', '')::NUMERIC;

        IF v_item_type NOT IN ('service', 'product') OR v_item_qty IS NULL OR v_item_qty <= 0 OR v_item_price IS NULL OR v_item_price < 0 THEN
            RAISE EXCEPTION 'Invalid checkout line item'
                USING ERRCODE = '22023';
        END IF;

        IF v_item_type = 'service' THEN
            v_service_id := NULLIF(v_item->>'serviceId', '')::UUID;
            v_product_id := NULL;

            PERFORM 1
            FROM public.services s
            WHERE s.id = v_service_id
              AND s.center_id = p_center_id
              AND s.deleted_at IS NULL
              AND s.is_active = true;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Service is not available for this center'
                    USING ERRCODE = '23503';
            END IF;
        ELSE
            v_service_id := NULL;
            v_product_id := NULLIF(v_item->>'productId', '')::UUID;

            PERFORM 1
            FROM public.products p
            WHERE p.id = v_product_id
              AND p.center_id = p_center_id
              AND p.deleted_at IS NULL
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product is not available for this center'
                    USING ERRCODE = '23503';
            END IF;
        END IF;

        v_total := v_total + (v_item_price * v_item_qty);
    END LOOP;

    IF COALESCE(p_use_loyalty_points, false) THEN
        SELECT LEAST(v_total - v_discount, COALESCE(c.loyalty_points, 0)::NUMERIC)
        INTO v_loyalty_discount
        FROM public.customers c
        WHERE c.id = p_customer_id
          AND c.center_id = p_center_id;

        v_loyalty_discount := GREATEST(0.000, COALESCE(v_loyalty_discount, 0.000));
    END IF;

    v_total := GREATEST(0.000, v_total - v_discount - v_loyalty_discount);
    v_earned_points := FLOOR(v_total);

    INSERT INTO public.invoices (
        center_id,
        customer_id,
        employee_id,
        serial_number,
        payment_method,
        total_amount,
        discount,
        loyalty_points_used
    )
    VALUES (
        p_center_id,
        p_customer_id,
        p_employee_id,
        'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
        p_payment_method,
        v_total,
        v_discount,
        v_loyalty_discount
    )
    RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_item_type := v_item->>'type';
        v_item_qty := NULLIF(v_item->>'qty', '')::NUMERIC;
        v_item_price := NULLIF(v_item->>'price', '')::NUMERIC;
        v_service_id := CASE WHEN v_item_type = 'service' THEN NULLIF(v_item->>'serviceId', '')::UUID ELSE NULL END;
        v_product_id := CASE WHEN v_item_type = 'product' THEN NULLIF(v_item->>'productId', '')::UUID ELSE NULL END;

        INSERT INTO public.invoice_items (
            invoice_id,
            service_id,
            product_id,
            price,
            quantity
        )
        VALUES (
            v_invoice_id,
            v_service_id,
            v_product_id,
            v_item_price,
            v_item_qty
        );

        IF v_item_type = 'product' THEN
            UPDATE public.products p
            SET stock_quantity = p.stock_quantity - v_item_qty::INTEGER
            WHERE p.id = v_product_id
              AND p.center_id = p_center_id
              AND p.stock_quantity >= v_item_qty
              AND v_item_qty = trunc(v_item_qty);

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Insufficient product stock'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;

    UPDATE public.customers c
    SET total_spent = COALESCE(c.total_spent, 0) + v_total,
        loyalty_points = GREATEST(0, COALESCE(c.loyalty_points, 0) - v_loyalty_discount::INTEGER) + v_earned_points::INTEGER,
        last_visit = now(),
        updated_at = now()
    WHERE c.id = p_customer_id
      AND c.center_id = p_center_id;

    SELECT to_jsonb(i)
    INTO v_updated_invoice
    FROM public.invoices i
    WHERE i.id = v_invoice_id;

    RETURN jsonb_build_object(
        'invoice', v_updated_invoice,
        'total', v_total,
        'earned', v_earned_points
    );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB) TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.invoice_items TO authenticated;

COMMIT;

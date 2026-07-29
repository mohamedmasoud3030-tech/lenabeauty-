-- ============================================================
-- LenaBeauty — Checkout RPC (process_checkout_v1)
--
-- This is the OFFICIAL migration of the checkout transaction.
-- It supersedes the draft in docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql,
-- which depended on schema elements that do NOT exist in the actual
-- initial schema (soft-delete `deleted_at`, a `member_role` enum, and
-- `app_private.has_center_role`).
--
-- This version is aligned to the REAL schema produced by
-- 20260623000001_initial_schema.sql + 20260628000001_enable_rls.sql:
--   * hard-delete model (no deleted_at)            -> matches repositories.ts
--   * membership check via app_private.is_center_member (from RLS migration)
--   * customers.loyalty_points / products.stock_quantity / employees.is_active
--
-- Pricing semantics (must match src/pages/PosInvoicesPage.tsx):
--   subtotal        = Σ(price × qty)
--   loyaltyDiscount = clamp(loyalty_points, 0 .. subtotal - discount)  (1 pt = 1 OMR)
--   total           = max(0, subtotal - discount - loyaltyDiscount)
--   earnedPoints    = floor(total)
--
-- HOW TO RUN: Supabase SQL Editor, AFTER the schema + RLS migrations.
-- ============================================================

-- Safety: function relies on app_private.is_center_member (RLS migration).
CREATE OR REPLACE FUNCTION public.process_checkout_v1(
    p_center_id          UUID,
    p_customer_id        UUID,
    p_employee_id        UUID,
    p_payment_method     TEXT,
    p_discount_amount    NUMERIC,
    p_use_loyalty_points BOOLEAN,
    p_items              JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
    v_invoice_id       UUID;
    v_total            NUMERIC(12,3) := 0.000;
    v_item             JSONB;
    v_item_type        TEXT;
    v_item_qty         NUMERIC(12,3);
    v_item_price       NUMERIC(12,3);
    v_service_id       UUID;
    v_product_id       UUID;
    v_discount         NUMERIC(12,3) := GREATEST(0.000, COALESCE(p_discount_amount, 0.000));
    v_loyalty_discount NUMERIC(12,3) := 0.000;
    v_earned_points    NUMERIC(12,3) := 0.000;
    v_updated_invoice  JSONB;
BEGIN
    -- 1. Authorization: caller must belong to the center.
    IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
        RAISE EXCEPTION 'Unauthorized checkout center' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate payment method.
    IF p_payment_method NOT IN ('cash', 'card', 'transfer') THEN
        RAISE EXCEPTION 'Unsupported payment method' USING ERRCODE = '22023';
    END IF;

    -- 3. Validate items array.
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Checkout items must be a non-empty array' USING ERRCODE = '22023';
    END IF;

    -- 4. Validate customer belongs to the center.
    PERFORM 1 FROM public.customers c
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer is not available for this center' USING ERRCODE = '23503';
    END IF;

    -- 5. Validate employee (optional) belongs to the center and is active.
    IF p_employee_id IS NOT NULL THEN
        PERFORM 1 FROM public.employees e
        WHERE e.id = p_employee_id AND e.center_id = p_center_id AND e.is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Employee is not available for this center' USING ERRCODE = '23503';
        END IF;
    END IF;

    -- 6. Validate each line item and accumulate the subtotal.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_item_type  := v_item->>'type';
        v_item_qty   := NULLIF(v_item->>'qty', '')::NUMERIC;
        v_item_price := NULLIF(v_item->>'price', '')::NUMERIC;

        IF v_item_type NOT IN ('service', 'product')
           OR v_item_qty IS NULL OR v_item_qty <= 0
           OR v_item_price IS NULL OR v_item_price < 0 THEN
            RAISE EXCEPTION 'Invalid checkout line item' USING ERRCODE = '22023';
        END IF;

        IF v_item_type = 'service' THEN
            v_service_id := NULLIF(v_item->>'serviceId', '')::UUID;
            PERFORM 1 FROM public.services s
            WHERE s.id = v_service_id AND s.center_id = p_center_id AND s.is_active = true;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Service is not available for this center' USING ERRCODE = '23503';
            END IF;
        ELSE
            v_product_id := NULLIF(v_item->>'productId', '')::UUID;
            PERFORM 1 FROM public.products p
            WHERE p.id = v_product_id AND p.center_id = p_center_id
            FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Product is not available for this center' USING ERRCODE = '23503';
            END IF;
        END IF;

        v_total := v_total + (v_item_price * v_item_qty);
    END LOOP;

    -- 7. Loyalty: 1 point = 1 OMR, capped at (subtotal - manual discount).
    IF COALESCE(p_use_loyalty_points, false) THEN
        SELECT LEAST(GREATEST(v_total - v_discount, 0.000), COALESCE(c.loyalty_points, 0)::NUMERIC)
        INTO v_loyalty_discount
        FROM public.customers c
        WHERE c.id = p_customer_id AND c.center_id = p_center_id;

        v_loyalty_discount := GREATEST(0.000, COALESCE(v_loyalty_discount, 0.000));
    END IF;

    v_total := GREATEST(0.000, v_total - v_discount - v_loyalty_discount);
    v_earned_points := FLOOR(v_total);

    -- 8. Create the invoice header.
    INSERT INTO public.invoices (
        center_id, customer_id, employee_id, serial_number,
        payment_method, total_amount, discount, loyalty_points_used
    )
    VALUES (
        p_center_id, p_customer_id, p_employee_id,
        'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
            upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
        p_payment_method, v_total, v_discount, v_loyalty_discount::INTEGER
    )
    RETURNING id INTO v_invoice_id;

    -- 9. Insert line items + decrement product stock.
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_item_type  := v_item->>'type';
        v_item_qty   := NULLIF(v_item->>'qty', '')::NUMERIC;
        v_item_price := NULLIF(v_item->>'price', '')::NUMERIC;
        v_service_id := CASE WHEN v_item_type = 'service' THEN NULLIF(v_item->>'serviceId', '')::UUID ELSE NULL END;
        v_product_id := CASE WHEN v_item_type = 'product' THEN NULLIF(v_item->>'productId', '')::UUID ELSE NULL END;

        INSERT INTO public.invoice_items (invoice_id, service_id, product_id, price, quantity)
        VALUES (v_invoice_id, v_service_id, v_product_id, v_item_price, v_item_qty::INTEGER);

        IF v_item_type = 'product' THEN
            UPDATE public.products p
            SET stock_quantity = p.stock_quantity - v_item_qty::INTEGER
            WHERE p.id = v_product_id
              AND p.center_id = p_center_id
              AND p.stock_quantity >= v_item_qty
              AND v_item_qty = trunc(v_item_qty);
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Insufficient product stock' USING ERRCODE = '23514';
            END IF;
        END IF;
    END LOOP;

    -- 10. Update customer aggregates (spend, loyalty balance, last visit).
    UPDATE public.customers c
    SET total_spent    = COALESCE(c.total_spent, 0) + v_total,
        loyalty_points = GREATEST(0, COALESCE(c.loyalty_points, 0) - v_loyalty_discount::INTEGER) + v_earned_points::INTEGER,
        last_visit     = now(),
        updated_at     = now()
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;

    -- 11. Return the created invoice + totals.
    SELECT to_jsonb(i) INTO v_updated_invoice
    FROM public.invoices i WHERE i.id = v_invoice_id;

    RETURN jsonb_build_object(
        'invoice', v_updated_invoice,
        'total',   v_total,
        'earned',  v_earned_points
    );
END;
$$;

REVOKE ALL    ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB) TO authenticated;

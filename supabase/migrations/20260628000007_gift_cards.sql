-- ============================================================
-- LenaBeauty — Gift Cards (issue + redeem at checkout)
--
-- Adds tenant-isolated gift card balances plus an issuance RPC.
-- Checkout redemption is integrated by a follow-up update to
-- process_checkout_v1 in this same migration.
--
-- Security rules:
--   * all write RPCs are SECURITY DEFINER
--   * membership check via app_private.is_center_member
--   * aligned to actual hard-delete schema (no deleted_at/member_role)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  initial_balance NUMERIC(12,3) NOT NULL,
  current_balance NUMERIC(12,3) NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  note TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gift_cards_balance_non_negative CHECK (initial_balance >= 0 AND current_balance >= 0),
  CONSTRAINT gift_cards_code_non_empty CHECK (length(btrim(code)) >= 4),
  CONSTRAINT gift_cards_center_code_unique UNIQUE (center_id, code)
);

CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES public.centers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount NUMERIC(12,3) NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gift_card_transactions_kind_check CHECK (kind IN ('ISSUED', 'REDEEMED', 'ADJUSTED')),
  CONSTRAINT gift_card_transactions_amount_positive CHECK (amount > 0)
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gift_cards_center ON public.gift_cards(center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON public.gift_cards(center_id, code);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_card ON public.gift_card_transactions(gift_card_id, created_at DESC);

DROP POLICY IF EXISTS gift_cards_select_member ON public.gift_cards;
CREATE POLICY gift_cards_select_member ON public.gift_cards
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS gift_cards_insert_member ON public.gift_cards;
CREATE POLICY gift_cards_insert_member ON public.gift_cards
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS gift_cards_update_member ON public.gift_cards;
CREATE POLICY gift_cards_update_member ON public.gift_cards
  FOR UPDATE TO authenticated
  USING (app_private.is_center_member(center_id))
  WITH CHECK (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS gift_cards_delete_member ON public.gift_cards;
CREATE POLICY gift_cards_delete_member ON public.gift_cards
  FOR DELETE TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS gift_card_transactions_select_member ON public.gift_card_transactions;
CREATE POLICY gift_card_transactions_select_member ON public.gift_card_transactions
  FOR SELECT TO authenticated
  USING (app_private.is_center_member(center_id));

DROP POLICY IF EXISTS gift_card_transactions_insert_member ON public.gift_card_transactions;
CREATE POLICY gift_card_transactions_insert_member ON public.gift_card_transactions
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_center_member(center_id));

CREATE OR REPLACE FUNCTION app_private.set_gift_card_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_gift_card_updated_at ON public.gift_cards;
CREATE TRIGGER set_gift_card_updated_at
BEFORE UPDATE ON public.gift_cards
FOR EACH ROW EXECUTE FUNCTION app_private.set_gift_card_updated_at();

CREATE OR REPLACE FUNCTION public.issue_gift_card_v1(
  p_center_id UUID,
  p_code TEXT,
  p_initial_balance NUMERIC,
  p_customer_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  v_card public.gift_cards%ROWTYPE;
  v_code TEXT := upper(btrim(COALESCE(p_code, '')));
  v_balance NUMERIC(12,3) := round(COALESCE(p_initial_balance, 0)::numeric, 3);
BEGIN
  IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
    RAISE EXCEPTION 'Unauthorized gift card center' USING ERRCODE = '42501';
  END IF;

  IF length(v_code) < 4 THEN
    RAISE EXCEPTION 'Gift card code is required' USING ERRCODE = '22023';
  END IF;

  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'Gift card balance must be positive' USING ERRCODE = '22023';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.customers c
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer is not available for this center' USING ERRCODE = '23503';
    END IF;
  END IF;

  INSERT INTO public.gift_cards (
    center_id, code, initial_balance, current_balance, customer_id, note, expires_at, is_active
  ) VALUES (
    p_center_id, v_code, v_balance, v_balance, p_customer_id, NULLIF(btrim(COALESCE(p_note, '')), ''), p_expires_at, true
  )
  RETURNING * INTO v_card;

  INSERT INTO public.gift_card_transactions (
    gift_card_id, center_id, kind, amount, note
  ) VALUES (
    v_card.id, p_center_id, 'ISSUED', v_balance, COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'Initial issuance')
  );

  RETURN jsonb_build_object('gift_card', to_jsonb(v_card));
END;
$$;

REVOKE ALL ON FUNCTION public.issue_gift_card_v1(UUID, TEXT, NUMERIC, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_gift_card_v1(UUID, TEXT, NUMERIC, UUID, TEXT, TIMESTAMPTZ) TO authenticated;

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
SET search_path = public, app_private
AS $$
DECLARE
    v_invoice_id       UUID;
    v_total            NUMERIC(12,3) := 0.000;
    v_subtotal         NUMERIC(12,3) := 0.000;
    v_tax_rate         NUMERIC(12,3) := 0.000;
    v_tax_amount       NUMERIC(12,3) := 0.000;
    v_item             JSONB;
    v_item_type        TEXT;
    v_item_qty         NUMERIC(12,3);
    v_item_price       NUMERIC(12,3);
    v_service_id       UUID;
    v_product_id       UUID;
    v_discount         NUMERIC(12,3) := GREATEST(0.000, COALESCE(p_discount_amount, 0.000));
    v_loyalty_discount NUMERIC(12,3) := 0.000;
    v_gift_card_discount NUMERIC(12,3) := 0.000;
    v_earned_points    NUMERIC(12,3) := 0.000;
    v_updated_invoice  JSONB;
    v_tier_percent     NUMERIC(12,3) := 0.000;
    v_tier_discount    NUMERIC(12,3) := 0.000;
    v_gift_card public.gift_cards%ROWTYPE;
    v_gift_code TEXT := upper(NULLIF(btrim(COALESCE(p_gift_card_code, '')), ''));
BEGIN
    IF p_center_id IS NULL OR NOT app_private.is_center_member(p_center_id) THEN
        RAISE EXCEPTION 'Unauthorized checkout center' USING ERRCODE = '42501';
    END IF;

    IF p_payment_method NOT IN ('cash', 'card', 'transfer') THEN
        RAISE EXCEPTION 'Unsupported payment method' USING ERRCODE = '22023';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Checkout items must be a non-empty array' USING ERRCODE = '22023';
    END IF;

    PERFORM 1 FROM public.customers c
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer is not available for this center' USING ERRCODE = '23503';
    END IF;

    IF p_employee_id IS NOT NULL THEN
        PERFORM 1 FROM public.employees e
        WHERE e.id = p_employee_id AND e.center_id = p_center_id AND e.is_active = true;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Employee is not available for this center' USING ERRCODE = '23503';
        END IF;
    END IF;

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

        v_subtotal := v_subtotal + (v_item_price * v_item_qty);
    END LOOP;

    SELECT tax_rate
      INTO v_tax_rate
    FROM public.center_settings cs
    WHERE cs.center_id = p_center_id;
    v_tax_rate := GREATEST(0.000, COALESCE(v_tax_rate, 0.000));

    SELECT CASE
             WHEN COALESCE(c.total_spent, 0) >= 1000 THEN 15
             WHEN COALESCE(c.total_spent, 0) >= 500 THEN 10
             WHEN COALESCE(c.total_spent, 0) >= 200 THEN 5
             ELSE 0
           END
      INTO v_tier_percent
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;
    v_tier_percent := GREATEST(0.000, COALESCE(v_tier_percent, 0.000));
    v_tier_discount := ROUND((v_subtotal * v_tier_percent / 100.000) * 1000) / 1000;

    IF COALESCE(p_use_loyalty_points, false) THEN
        SELECT LEAST(GREATEST(v_subtotal - v_discount - v_tier_discount, 0.000), COALESCE(c.loyalty_points, 0)::NUMERIC)
        INTO v_loyalty_discount
        FROM public.customers c
        WHERE c.id = p_customer_id AND c.center_id = p_center_id;

        v_loyalty_discount := GREATEST(0.000, COALESCE(v_loyalty_discount, 0.000));
    END IF;

    IF v_gift_code IS NOT NULL THEN
      SELECT *
        INTO v_gift_card
      FROM public.gift_cards gc
      WHERE gc.center_id = p_center_id
        AND gc.code = v_gift_code
        AND gc.is_active = true
        AND (gc.expires_at IS NULL OR gc.expires_at >= now())
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Gift card is not available for this center' USING ERRCODE = '23503';
      END IF;

      v_gift_card_discount := LEAST(
        GREATEST(v_subtotal - v_discount - v_tier_discount - v_loyalty_discount, 0.000),
        COALESCE(v_gift_card.current_balance, 0.000)
      );
      v_gift_card_discount := GREATEST(0.000, COALESCE(v_gift_card_discount, 0.000));
    END IF;

    v_total := GREATEST(0.000, v_subtotal - v_discount - v_tier_discount - v_loyalty_discount - v_gift_card_discount);
    v_tax_amount := ROUND((v_total * v_tax_rate / 100.000) * 1000) / 1000;
    v_total := v_total + v_tax_amount;
    v_earned_points := FLOOR(GREATEST(v_total - v_tax_amount, 0.000));

    INSERT INTO public.invoices (
        center_id, customer_id, employee_id, serial_number,
        payment_method, total_amount, discount, loyalty_points_used, tax
    )
    VALUES (
        p_center_id, p_customer_id, p_employee_id,
        'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
            upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8)),
        p_payment_method, v_total, (v_discount + v_tier_discount + v_gift_card_discount), v_loyalty_discount::INTEGER, v_tax_amount
    )
    RETURNING id INTO v_invoice_id;

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

    IF v_gift_card_discount > 0 AND v_gift_code IS NOT NULL THEN
      UPDATE public.gift_cards gc
         SET current_balance = GREATEST(0.000, gc.current_balance - v_gift_card_discount),
             is_active = CASE WHEN GREATEST(0.000, gc.current_balance - v_gift_card_discount) > 0 THEN gc.is_active ELSE false END,
             updated_at = now()
       WHERE gc.id = v_gift_card.id;

      INSERT INTO public.gift_card_transactions (
        gift_card_id, center_id, kind, amount, invoice_id, note
      ) VALUES (
        v_gift_card.id, p_center_id, 'REDEEMED', v_gift_card_discount, v_invoice_id, 'Redeemed during checkout'
      );
    END IF;

    UPDATE public.customers c
    SET total_spent    = COALESCE(c.total_spent, 0) + GREATEST(v_total - v_tax_amount, 0.000),
        loyalty_points = GREATEST(0, COALESCE(c.loyalty_points, 0) - v_loyalty_discount::INTEGER) + v_earned_points::INTEGER,
        last_visit     = now(),
        updated_at     = now()
    WHERE c.id = p_customer_id AND c.center_id = p_center_id;

    SELECT to_jsonb(i) INTO v_updated_invoice
    FROM public.invoices i WHERE i.id = v_invoice_id;

    RETURN jsonb_build_object(
        'invoice', v_updated_invoice,
        'total',   v_total,
        'earned',  v_earned_points,
        'gift_card_redeemed', v_gift_card_discount
    );
END;
$$;

REVOKE ALL    ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.process_checkout_v1(UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT) TO authenticated;

-- DRAFT ONLY - DO NOT EXECUTE
-- Supabase RPC Functions Draft

-- RPC for ATOMIC POS CHECKOUT
-- Ensures inventory stock is decremented accurately and prevents race conditions from simultaneous checkouts.
-- Bypasses the restrictive INSERT RLS policies via SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.checkout_invoice(
  p_center_id UUID,
  p_customer_id UUID,
  p_payment_method VARCHAR(50),
  p_discount NUMERIC(12, 3),
  p_loyalty_points_to_use INTEGER,
  p_items JSONB -- Type: Array<{ type: 'service' | 'product', id: UUID, quantity: INTEGER }>
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_amount NUMERIC(15, 3) := 0.000;
  v_invoice_id UUID;
  v_current_item JSONB;
  v_price NUMERIC(12, 3);
  v_stock INTEGER;
  v_auth_uid UUID := auth.uid();
  v_profile_id UUID := v_auth_uid; -- assuming profile_id matches auth.uid() directly or via lookup
BEGIN
  -- 1. Authorization Verification
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT app_private.has_center_role(p_center_id, ARRAY['owner'::public.member_role, 'admin'::public.member_role, 'manager'::public.member_role, 'staff'::public.member_role]) THEN
    RAISE EXCEPTION 'Unauthorized POS transaction';
  END IF;

  -- 2. Pre-Verification & Inventory Lock Loop
  FOR v_current_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    IF v_current_item->>'type' = 'product' THEN
      -- FOR UPDATE explicitly locks the row in postgres allowing safe mutation avoiding negative stock values
      SELECT price, stock_quantity INTO v_price, v_stock 
      FROM public.products 
      WHERE id = (v_current_item->>'id')::UUID AND center_id = p_center_id
      FOR UPDATE; 

      IF v_stock < (v_current_item->>'quantity')::INTEGER THEN
        RAISE EXCEPTION 'Insufficient stock for product ID: %', v_current_item->>'id';
      END IF;
      
      v_total_amount := v_total_amount + (v_price * (v_current_item->>'quantity')::INTEGER);
    ELSE
      SELECT price INTO v_price 
      FROM public.services 
      WHERE id = (v_current_item->>'id')::UUID AND center_id = p_center_id;
      
      v_total_amount := v_total_amount + (v_price * (v_current_item->>'quantity')::INTEGER);
    END IF;
  END LOOP;

  -- 3. Header Insertion
  INSERT INTO public.invoices (center_id, customer_id, total_amount, discount, loyalty_points_used, status)
  VALUES (p_center_id, p_customer_id, v_total_amount - p_discount, p_discount, p_loyalty_points_to_use, 'FINALIZED')
  RETURNING id INTO v_invoice_id;

  -- 4. Line Deduction & Inventory Movement Execution
  FOR v_current_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_items)
  LOOP
    IF v_current_item->>'type' = 'product' THEN
       SELECT price INTO v_price FROM public.products WHERE id = (v_current_item->>'id')::UUID;
       
       INSERT INTO public.invoice_items (center_id, invoice_id, product_id, price, quantity)
       VALUES (p_center_id, v_invoice_id, (v_current_item->>'id')::UUID, v_price, (v_current_item->>'quantity')::INTEGER);

       -- Update cached balance
       UPDATE public.products 
       SET stock_quantity = stock_quantity - (v_current_item->>'quantity')::INTEGER 
       WHERE id = (v_current_item->>'id')::UUID;

       -- Add authoritative ledger entry
       INSERT INTO public.inventory_movements (center_id, product_id, movement_type, quantity_delta, reason, invoice_id, created_by_profile_id)
       VALUES (p_center_id, (v_current_item->>'id')::UUID, 'checkout', -1 * (v_current_item->>'quantity')::INTEGER, 'POS Checkout', v_invoice_id, v_profile_id);
    ELSE
       SELECT price INTO v_price FROM public.services WHERE id = (v_current_item->>'id')::UUID;
       
       INSERT INTO public.invoice_items (center_id, invoice_id, service_id, price, quantity)
       VALUES (p_center_id, v_invoice_id, (v_current_item->>'id')::UUID, v_price, (v_current_item->>'quantity')::INTEGER);
    END IF;
  END LOOP;

  -- 5. Payment Creation
  INSERT INTO public.payments (center_id, invoice_id, amount, payment_method, created_by_profile_id)
  VALUES (p_center_id, v_invoice_id, v_total_amount - p_discount, p_payment_method, v_profile_id);

  -- 6. Return Output Mapping DTO
  RETURN pg_catalog.jsonb_build_object(
    'invoice_id', v_invoice_id,
    'total_amount', v_total_amount - p_discount
  );
END;
$$;

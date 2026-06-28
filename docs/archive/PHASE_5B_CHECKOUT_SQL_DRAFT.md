# Phase 5B Checkout SQL Draft

**SUPERSEDED BY PHASE 10B ACTIVATION SQL**
This file preserves the original checkout schema draft for design history. Apply `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` for the reviewed executable Supabase SQL that creates `invoices`, `invoice_items`, and `process_checkout_v1`.

## 1. Tables (If they don't already exist)

```sql
-- Invoices Table
CREATE TABLE invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  employee_id uuid,
  serial_number text,
  payment_method text NOT NULL,
  total_amount numeric NOT NULL,
  discount numeric DEFAULT 0,
  loyalty_points_used numeric DEFAULT 0,
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Invoice Items Table
CREATE TABLE invoice_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id uuid,
  product_id uuid,
  price numeric NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Note: We map employee/customer using references if you have strict FKs:
-- ALTER TABLE invoices ADD CONSTRAINT fk_inv_center FOREIGN KEY (center_id) REFERENCES center_settings(center_id);
```

## 2. RPC: `process_checkout_v1`
Because multiple tables scale simultaneously with checkout (invoices, items, and product decrements), and because no frontend client can perform transactional atomicity securely, an RPC is strictly required.

```sql
CREATE OR REPLACE FUNCTION process_checkout_v1(
  p_center_id uuid,
  p_customer_id uuid,
  p_employee_id uuid,
  p_payment_method text,
  p_discount_amount numeric,
  p_use_loyalty_points boolean,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
  v_total numeric := 0;
  v_item jsonb;
  v_loyalty_discount numeric := 0;
  v_earned_points numeric := 0;
  v_updated_invoice jsonb;
BEGIN
  -- 1. Calculate raw total from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total := v_total + ((v_item->>'price')::numeric * (v_item->>'qty')::numeric);
  END LOOP;

  -- 2. Optional: handle loyalty logic (simplified here)
  IF p_use_loyalty_points THEN
    -- Look up customer loyalty points and deduct total
    -- v_loyalty_discount := ... 
  END IF;

  v_total := GREATEST(0, v_total - p_discount_amount - v_loyalty_discount);

  -- 3. Create invoice record
  INSERT INTO invoices (
      center_id, customer_id, employee_id, payment_method, 
      total_amount, discount, loyalty_points_used
  ) VALUES (
      p_center_id, p_customer_id, p_employee_id, p_payment_method, 
      v_total, p_discount_amount, v_loyalty_discount
  ) RETURNING id INTO v_invoice_id;

  -- 4. Process individual items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Insert line item
    INSERT INTO invoice_items (
      invoice_id, service_id, product_id, price, quantity
    ) VALUES (
      v_invoice_id,
      CASE WHEN v_item->>'type' = 'service' THEN (v_item->>'serviceId')::uuid ELSE NULL END,
      CASE WHEN v_item->>'type' = 'product' THEN (v_item->>'productId')::uuid ELSE NULL END,
      (v_item->>'price')::numeric,
      (v_item->>'qty')::numeric
    );

    -- 5. Decrement stock for products
    IF v_item->>'type' = 'product' THEN
      UPDATE products 
      SET stock_quantity = stock_quantity - (v_item->>'qty')::numeric
      WHERE id = (v_item->>'productId')::uuid AND center_id = p_center_id;
    END IF;
  END LOOP;

  -- Select returning data mapping the interface: { invoice: Invoice, total: number, earned: number }
  SELECT to_jsonb(i) INTO v_updated_invoice FROM invoices i WHERE id = v_invoice_id;

  RETURN jsonb_build_object(
    'invoice', v_updated_invoice,
    'total', v_total,
    'earned', v_earned_points
  );
END;
$$;
```

## 3. RLS Rules & Recommendations

1. `invoices`:
   - SELECT: `center_id = auth.jwt()->>'app_metadata'->'center_id'`
   - INSERT: (handled by SECURITY DEFINER in the RPC function, protecting direct inserts).
2. `invoice_items`:
   - SELECT: Join validation with `invoices.center_id`.

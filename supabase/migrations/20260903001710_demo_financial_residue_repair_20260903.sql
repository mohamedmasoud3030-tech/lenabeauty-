DO $$
DECLARE
  v_demo_center CONSTANT uuid := '7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d';
  v_remaining integer;
  v_eligible integer;
  v_distinct_customers integer;
  v_updated integer;
  v_deleted integer;
BEGIN
  SELECT count(*) INTO v_remaining
  FROM public.invoices i
  WHERE i.center_id = v_demo_center
    AND i.serial_number = ANY (ARRAY[
      'INV-20260809-D1FE39A6',
      'INV-20260809-2C9EF4CA',
      'INV-20260809-406EB21F',
      'INV-20260809-D479A500',
      'INV-20260809-9E7AB927'
    ]::text[]);

  IF v_remaining = 0 THEN
    RAISE NOTICE 'LENA Demo financial residue already repaired; no-op.';
    RETURN;
  END IF;

  IF v_remaining <> 5 THEN
    RAISE EXCEPTION 'Refusing partial Demo repair: expected 5 known serials, found %', v_remaining;
  END IF;

  SELECT count(*), count(DISTINCT i.customer_id)
  INTO v_eligible, v_distinct_customers
  FROM public.invoices i
  WHERE i.center_id = v_demo_center
    AND i.serial_number = ANY (ARRAY[
      'INV-20260809-D1FE39A6',
      'INV-20260809-2C9EF4CA',
      'INV-20260809-406EB21F',
      'INV-20260809-D479A500',
      'INV-20260809-9E7AB927'
    ]::text[])
    AND i.created_at >= timestamptz '2026-08-09 00:00:00+00'
    AND i.created_at <  timestamptz '2026-08-10 00:00:00+00'
    AND i.status = 'PAID'
    AND i.total_amount = 10.000
    AND i.amount_paid = 0.000
    AND i.subtotal_amount = 0.000
    AND i.manual_discount = 0.000
    AND i.tier_discount = 0.000
    AND i.loyalty_discount = 0.000
    AND i.gift_card_discount = 0.000
    AND i.entitlement_redemption = 0.000
    AND i.tax = 0.000
    AND i.appointment_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.checkout_idempotency c WHERE c.invoice_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.entitlement_ledger e WHERE e.invoice_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.inventory_consumptions c WHERE c.invoice_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.gift_card_transactions g WHERE g.invoice_id = i.id)
    AND NOT EXISTS (SELECT 1 FROM public.customer_entitlements e WHERE e.source_invoice_id = i.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.accounting_journal_entries a
      WHERE a.reference_id = i.id
        AND a.reference_type ILIKE '%invoice%'
    )
    AND (SELECT count(*) FROM public.invoice_items ii WHERE ii.invoice_id = i.id) = 1
    AND EXISTS (
      SELECT 1
      FROM public.invoice_items ii
      WHERE ii.invoice_id = i.id
        AND ii.quantity = 1
        AND ii.price = 10.000
        AND ii.product_id IS NULL
        AND ii.service_id IS NOT NULL
    );

  IF v_eligible <> 5 OR v_distinct_customers <> 5 THEN
    RAISE EXCEPTION 'Refusing Demo repair: eligible invoices %, distinct customers %; expected 5/5', v_eligible, v_distinct_customers;
  END IF;

  UPDATE public.customers c
  SET loyalty_points = c.loyalty_points - 10
  WHERE c.center_id = v_demo_center
    AND c.loyalty_points >= 10
    AND c.id IN (
      SELECT DISTINCT i.customer_id
      FROM public.invoices i
      WHERE i.center_id = v_demo_center
        AND i.serial_number = ANY (ARRAY[
          'INV-20260809-D1FE39A6',
          'INV-20260809-2C9EF4CA',
          'INV-20260809-406EB21F',
          'INV-20260809-D479A500',
          'INV-20260809-9E7AB927'
        ]::text[])
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 5 THEN
    RAISE EXCEPTION 'Refusing Demo repair: loyalty reversal updated % customers, expected 5', v_updated;
  END IF;

  DELETE FROM public.invoices i
  WHERE i.center_id = v_demo_center
    AND i.serial_number = ANY (ARRAY[
      'INV-20260809-D1FE39A6',
      'INV-20260809-2C9EF4CA',
      'INV-20260809-406EB21F',
      'INV-20260809-D479A500',
      'INV-20260809-9E7AB927'
    ]::text[]);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted <> 5 THEN
    RAISE EXCEPTION 'Demo residue repair deleted % invoices, expected 5', v_deleted;
  END IF;

  RAISE NOTICE 'LENA Demo financial residue repaired: 5 orphaned invoices removed and 50 loyalty points reversed.';
END
$$;

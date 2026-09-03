-- LENA Beauty — Demo-only financial residue repair
-- Target: canonical Experimental Production / Demo center only.
--
-- Context:
-- Five legacy 2026-08-09 test invoices predate the current authoritative
-- checkout contract. They are marked PAID with total_amount = 10.000 while
-- amount_paid = 0.000 and have no payment rows. Each also contributed 10
-- loyalty points. They have no appointment, checkout-idempotency, entitlement,
-- gift-card, inventory-consumption, or accounting-journal references.
--
-- This repair deliberately DOES NOT invent cash payments. It removes only the
-- exact orphaned experimental invoices and reverses their exact loyalty effect.
-- The script is idempotent: after a successful run, a re-run is a no-op.

DO $$
DECLARE
  v_demo_center CONSTANT uuid := '7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d';
  v_remaining integer;
  v_eligible integer;
  v_customers_ready integer;
BEGIN
  CREATE TEMP TABLE _lena_demo_bad_invoice (
    invoice_id uuid PRIMARY KEY,
    customer_id uuid NOT NULL,
    expected_loyalty_reversal integer NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _lena_demo_bad_invoice (invoice_id, customer_id, expected_loyalty_reversal)
  VALUES
    ('41ba897f-3ae4-4845-a80c-3e66ddfaa47c', '1b992506-c5d4-4806-8212-09bd0fde918d', 10),
    ('38e2b634-3017-43b9-9a06-64144a91e89c', '128840e6-46d8-4645-b88e-0ccb3b3721ca', 10),
    ('5894492b-be1b-4877-a2c6-c129c585dfef', 'abd75bc5-7e28-4202-90c9-d808806f2822', 10),
    ('6a97c587-50bb-421d-826c-8134712f1ad2', 'c06f1f7a-c316-4c99-9007-006ca10782bb', 10),
    ('f328e84b-ebc1-468b-b58e-9b7deed7a095', 'adc2c8c7-5df7-495a-b48f-c57ec4890a35', 10);

  SELECT count(*) INTO v_remaining
  FROM public.invoices i
  JOIN _lena_demo_bad_invoice x ON x.invoice_id = i.id;

  IF v_remaining = 0 THEN
    RAISE NOTICE 'LENA Demo financial residue already repaired; no-op.';
    RETURN;
  END IF;

  -- Never apply a partial repair if the known residue set has drifted.
  IF v_remaining <> 5 THEN
    RAISE EXCEPTION 'Refusing partial Demo repair: expected 5 known invoices, found %', v_remaining;
  END IF;

  SELECT count(*) INTO v_eligible
  FROM public.invoices i
  JOIN _lena_demo_bad_invoice x
    ON x.invoice_id = i.id
   AND x.customer_id = i.customer_id
  WHERE i.center_id = v_demo_center
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
    AND (
      SELECT count(*)
      FROM public.invoice_items ii
      WHERE ii.invoice_id = i.id
    ) = 1
    AND EXISTS (
      SELECT 1
      FROM public.invoice_items ii
      WHERE ii.invoice_id = i.id
        AND ii.quantity = 1
        AND ii.price = 10.000
        AND ii.product_id IS NULL
        AND ii.service_id IS NOT NULL
    );

  IF v_eligible <> 5 THEN
    RAISE EXCEPTION 'Refusing Demo repair: only % of 5 invoices match the proven residue contract', v_eligible;
  END IF;

  SELECT count(*) INTO v_customers_ready
  FROM public.customers c
  JOIN _lena_demo_bad_invoice x ON x.customer_id = c.id
  WHERE c.center_id = v_demo_center
    AND c.loyalty_points >= x.expected_loyalty_reversal;

  IF v_customers_ready <> 5 THEN
    RAISE EXCEPTION 'Refusing Demo repair: loyalty state no longer safely supports all 5 reversals';
  END IF;

  UPDATE public.customers c
  SET loyalty_points = c.loyalty_points - x.expected_loyalty_reversal
  FROM _lena_demo_bad_invoice x
  WHERE c.id = x.customer_id
    AND c.center_id = v_demo_center;

  -- invoice_items cascade by the canonical FK. All other restricted references
  -- were proven absent above, so this delete cannot silently erase downstream
  -- financial or inventory state.
  DELETE FROM public.invoices i
  USING _lena_demo_bad_invoice x
  WHERE i.id = x.invoice_id
    AND i.center_id = v_demo_center;

  IF EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN _lena_demo_bad_invoice x ON x.invoice_id = i.id
  ) THEN
    RAISE EXCEPTION 'Demo residue repair did not remove the complete known invoice set';
  END IF;

  RAISE NOTICE 'LENA Demo financial residue repaired: 5 orphaned invoices removed and 50 loyalty points reversed.';
END
$$;

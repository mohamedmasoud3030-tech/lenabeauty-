-- Financial Entitlements live acceptance. Every fixture is rolled back.
BEGIN;

INSERT INTO public.centers(id, name) VALUES
  ('21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements test center');
INSERT INTO public.center_settings(center_id, name, currency) VALUES
  ('21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements test center', 'OMR');
INSERT INTO auth.users(id, email) VALUES
  ('31000000-0000-4000-8000-000000000001'::uuid, 'entitlements.member@lenabeauty.test');
INSERT INTO public.profiles(id, full_name) VALUES
  ('31000000-0000-4000-8000-000000000001'::uuid, 'Entitlements member');
INSERT INTO public.center_memberships(profile_id, center_id, role) VALUES
  ('31000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000001'::uuid, 'ADMIN');
INSERT INTO public.customers(id, center_id, name, phone) VALUES
  ('41000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements customer', '+96800010001');
INSERT INTO public.employees(id, center_id, name, role) VALUES
  ('51000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements employee', 'Staff');
INSERT INTO public.service_categories(id, center_id, name) VALUES
  ('60000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements category');
INSERT INTO public.services(id, center_id, name, category_id, price, duration_minutes) VALUES
  ('61000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements service', '60000000-0000-4000-8000-000000000001'::uuid, 10.000, 30);
INSERT INTO public.service_packages(id, center_id, name, package_price) VALUES
  ('71000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000001'::uuid, 'Entitlements package', 20.000);
INSERT INTO public.service_package_items(package_id, service_id, quantity) VALUES
  ('71000000-0000-4000-8000-000000000001'::uuid, '61000000-0000-4000-8000-000000000001'::uuid, 2);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);

DO $$
DECLARE
  v_gift_sale jsonb;
  v_gift_retry jsonb;
  v_gift_redeem jsonb;
  v_package_sale jsonb;
  v_package_redeem jsonb;
  v_gift_entitlement uuid;
  v_package_entitlement uuid;
  v_amount numeric;
  v_status text;
  v_units integer;
BEGIN
  v_gift_sale := public.process_checkout_idempotent_v1(
    '81000000-0000-4000-8000-000000000001'::uuid,
    '21000000-0000-4000-8000-000000000001'::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    '51000000-0000-4000-8000-000000000001'::uuid,
    'cash', 0, false,
    '[{"type":"gift_card","code":"LIVE-ENT-001","price":10,"qty":1}]'::jsonb
  );
  IF (v_gift_sale->'invoice'->>'total_amount')::numeric <> 10.000
     OR NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = (v_gift_sale->'invoice'->>'id')::uuid AND p.amount = 10.000) THEN
    RAISE EXCEPTION 'gift-card sale must collect cash';
  END IF;

  v_gift_retry := public.process_checkout_idempotent_v1(
    '81000000-0000-4000-8000-000000000001'::uuid,
    '21000000-0000-4000-8000-000000000001'::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    '51000000-0000-4000-8000-000000000001'::uuid,
    'cash', 0, false,
    '[{"type":"gift_card","code":"LIVE-ENT-001","price":10,"qty":1}]'::jsonb
  );
  IF v_gift_retry->'invoice'->>'id' <> v_gift_sale->'invoice'->>'id'
     OR (SELECT count(*) FROM public.payments WHERE center_id = '21000000-0000-4000-8000-000000000001'::uuid) <> 1 THEN
    RAISE EXCEPTION 'checkout retry must return the original financial posting';
  END IF;
  SELECT ce.id, ce.remaining_value, ce.status INTO v_gift_entitlement, v_amount, v_status
  FROM public.customer_entitlements ce WHERE ce.gift_card_id = (v_gift_sale->'gift_cards_issued'->0->>'gift_card_id')::uuid;
  IF v_amount <> 10.000 OR v_status <> 'ACTIVE'
     OR NOT EXISTS (SELECT 1 FROM public.entitlement_ledger el WHERE el.entitlement_id = v_gift_entitlement AND el.entry_type = 'ISSUE' AND el.amount = 10.000) THEN
    RAISE EXCEPTION 'gift-card sale must create a deferred entitlement';
  END IF;

  v_gift_redeem := public.process_checkout_idempotent_v1(
    '81000000-0000-4000-8000-000000000002'::uuid,
    '21000000-0000-4000-8000-000000000001'::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    '51000000-0000-4000-8000-000000000001'::uuid,
    'cash', 0, false,
    '[{"type":"service","serviceId":"61000000-0000-4000-8000-000000000001","qty":1}]'::jsonb,
    NULL,
    jsonb_build_array(jsonb_build_object('entitlementId', v_gift_entitlement, 'type', 'value', 'amount', 10))
  );
  IF (v_gift_redeem->'invoice'->>'total_amount')::numeric <> 0
     OR (v_gift_redeem->>'entitlement_redeemed')::numeric <> 10.000 THEN
    RAISE EXCEPTION 'gift-card redemption must cover service exactly once';
  END IF;
  SELECT remaining_value, status INTO v_amount, v_status FROM public.customer_entitlements WHERE id = v_gift_entitlement;
  IF v_amount <> 0 OR v_status <> 'FULLY_REDEEMED'
     OR (SELECT count(*) FROM public.entitlement_ledger WHERE entitlement_id = v_gift_entitlement AND entry_type = 'REDEEM') <> 1 THEN
    RAISE EXCEPTION 'gift-card redemption did not settle correctly';
  END IF;

  v_package_sale := public.process_checkout_idempotent_v1(
    '81000000-0000-4000-8000-000000000003'::uuid,
    '21000000-0000-4000-8000-000000000001'::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    '51000000-0000-4000-8000-000000000001'::uuid,
    'card', 0, false,
    '[{"type":"package","packageId":"71000000-0000-4000-8000-000000000001","qty":1}]'::jsonb
  );
  v_package_entitlement := (v_package_sale->'package_entitlements'->>0)::uuid;
  SELECT remaining_value INTO v_amount FROM public.customer_entitlements WHERE id = v_package_entitlement;
  SELECT total_units - used_units INTO v_units FROM public.package_entitlement_units WHERE entitlement_id = v_package_entitlement;
  IF v_amount <> 20.000 OR v_units <> 2 THEN
    RAISE EXCEPTION 'package sale must create its owned sessions and deferred value';
  END IF;

  v_package_redeem := public.process_checkout_idempotent_v1(
    '81000000-0000-4000-8000-000000000004'::uuid,
    '21000000-0000-4000-8000-000000000001'::uuid,
    '41000000-0000-4000-8000-000000000001'::uuid,
    '51000000-0000-4000-8000-000000000001'::uuid,
    'cash', 0, false,
    '[{"type":"service","serviceId":"61000000-0000-4000-8000-000000000001","qty":1}]'::jsonb,
    NULL,
    jsonb_build_array(jsonb_build_object('entitlementId', v_package_entitlement, 'type', 'units', 'serviceId', '61000000-0000-4000-8000-000000000001', 'units', 1))
  );
  SELECT remaining_value INTO v_amount FROM public.customer_entitlements WHERE id = v_package_entitlement;
  SELECT total_units - used_units INTO v_units FROM public.package_entitlement_units WHERE entitlement_id = v_package_entitlement;
  IF (v_package_redeem->'invoice'->>'total_amount')::numeric <> 0 OR v_amount <> 10.000 OR v_units <> 1 THEN
    RAISE EXCEPTION 'package redemption must consume exactly one service unit';
  END IF;

  PERFORM public.refund_entitlement_v1(v_package_entitlement, 10.000, 'Live acceptance unused balance', '51000000-0000-4000-8000-000000000001'::uuid);
  SELECT remaining_value, status INTO v_amount, v_status FROM public.customer_entitlements WHERE id = v_package_entitlement;
  IF v_amount <> 0 OR v_status <> 'REFUNDED'
     OR NOT EXISTS (SELECT 1 FROM public.entitlement_ledger WHERE entitlement_id = v_package_entitlement AND entry_type = 'REFUND' AND reason LIKE 'Refund:%') THEN
    RAISE EXCEPTION 'refund must append an auditable unused-balance reversal';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;

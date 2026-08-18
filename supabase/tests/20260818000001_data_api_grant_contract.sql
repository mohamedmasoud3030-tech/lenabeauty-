BEGIN;

DO $$
DECLARE
  v_table TEXT;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_extra TEXT[] := ARRAY[]::TEXT[];
  v_count INTEGER;
BEGIN
  SELECT array_agg(DISTINCT table_name ORDER BY table_name) INTO v_extra
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND grantee = 'anon';
  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'anon still holds table privileges on: %', array_to_string(v_extra, ', ');
  END IF;

  FOREACH v_table IN ARRAY ARRAY[
    'customers', 'appointments', 'services', 'products', 'expenses',
    'attendance_records', 'employee_advances', 'center_settings',
    'center_memberships', 'centers', 'profiles', 'employees',
    'invoices', 'invoice_items', 'payments', 'payroll_runs',
    'payroll_line_items', 'gift_cards', 'gift_card_transactions',
    'service_packages', 'service_package_items', 'service_files',
    'service_file_images', 'customer_reviews', 'accounting_journal_entries',
    'ai_booking_leads', 'notification_settings', 'payment_gateway_settings',
    'service_categories', 'customer_entitlements', 'entitlement_ledger',
    'package_entitlement_units', 'customer_notification_timeline'
  ] LOOP
    SELECT count(*) INTO v_count
    FROM (
      SELECT 1 FROM information_schema.table_privileges
       WHERE table_schema = 'public' AND table_name = v_table
         AND grantee = 'authenticated' AND privilege_type = 'SELECT'
      UNION ALL
      SELECT 1 FROM information_schema.column_privileges
       WHERE table_schema = 'public' AND table_name = v_table
         AND grantee = 'authenticated' AND privilege_type = 'SELECT'
    ) granted;
    IF v_count = 0 THEN v_missing := v_missing || v_table; END IF;
  END LOOP;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'authenticated cannot SELECT: %', array_to_string(v_missing, ', ');
  END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'employees'
    AND grantee = 'authenticated'
    AND column_name IN ('salary', 'base_salary', 'commission_percentage', 'month_commission_total');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'employee compensation columns are exposed to authenticated';
  END IF;

  SELECT array_agg(DISTINCT table_name ORDER BY table_name) INTO v_extra
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'DELETE';
  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'DELETE is granted to a client role on: %', array_to_string(v_extra, ', ');
  END IF;

  SELECT array_agg(DISTINCT table_name || ':' || privilege_type ORDER BY table_name || ':' || privilege_type)
    INTO v_extra
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE')
    AND table_name IN (
      'invoices', 'invoice_items', 'payments', 'gift_cards',
      'gift_card_transactions', 'customer_entitlements',
      'package_entitlement_units', 'entitlement_ledger',
      'payroll_runs', 'payroll_line_items', 'employees',
      'notification_settings', 'payment_gateway_settings',
      'accounting_journal_entries', 'ai_booking_leads', 'customer_reviews',
      'service_files', 'service_file_images', 'customer_notification_timeline',
      'service_packages', 'service_package_items'
    );
  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'RPC-owned tables are directly writable: %', array_to_string(v_extra, ', ');
  END IF;

  SELECT count(*) INTO v_count
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'checkout_idempotency'
    AND grantee IN ('anon', 'authenticated');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'checkout_idempotency is reachable by a client role';
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_extra
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'RLS is disabled on: %', array_to_string(v_extra, ', ');
  END IF;
END $$;

ROLLBACK;

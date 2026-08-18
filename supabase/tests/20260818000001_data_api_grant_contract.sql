-- Data API grant contract — live acceptance.
--
-- Runs against the real project after `supabase db push`, inside a transaction
-- that is always rolled back. It reads catalog metadata only: no business row
-- is created, modified or deleted.
--
-- Purpose: prove on the LIVE database what the offline suite proves against the
-- replayed chain — that the app's privileges are explicit, that `anon` has no
-- table surface, and that every deliberate containment boundary survived.

BEGIN;

DO $$
DECLARE
  v_table   TEXT;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_extra   TEXT[] := ARRAY[]::TEXT[];
  v_count   INTEGER;
BEGIN
  -- 1. `anon` must hold no privilege on any table in the public schema.
  SELECT array_agg(DISTINCT table_name ORDER BY table_name) INTO v_extra
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND grantee = 'anon';

  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'anon still holds table privileges on: %', array_to_string(v_extra, ', ');
  END IF;
  RAISE NOTICE 'PASS anon holds no table privilege in the public schema.';

  -- 2. Every table the staff UI reads must be SELECT-able by `authenticated`.
  --    Without the grant, PostgREST rejects the request before RLS is consulted
  --    and the page fails outright.
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
  ]
  LOOP
    -- Column-level grants (used by `employees`) surface only in
    -- column_privileges, so both catalogs are consulted.
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

    IF v_count = 0 THEN
      v_missing := v_missing || v_table;
    END IF;
  END LOOP;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'authenticated cannot SELECT: %', array_to_string(v_missing, ', ');
  END IF;
  RAISE NOTICE 'PASS authenticated can SELECT every table the staff UI reads.';

  -- 3. Employee compensation must never be reachable through the Data API.
  SELECT count(*) INTO v_count
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'employees'
    AND grantee = 'authenticated'
    AND column_name IN ('salary', 'base_salary', 'commission_percentage', 'month_commission_total');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'employee compensation columns are exposed to authenticated';
  END IF;
  RAISE NOTICE 'PASS employee compensation columns are not exposed.';

  -- 4. No client role may hard-delete retained records.
  SELECT array_agg(DISTINCT table_name ORDER BY table_name) INTO v_extra
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type = 'DELETE';

  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'DELETE is granted to a client role on: %', array_to_string(v_extra, ', ');
  END IF;
  RAISE NOTICE 'PASS no client role holds DELETE on any table.';

  -- 5. Financial and RPC-owned tables must stay read-only to clients.
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
  RAISE NOTICE 'PASS financial and RPC-owned tables are read-only to clients.';

  -- 6. The checkout idempotency ledger is private to its SECURITY DEFINER RPC.
  SELECT count(*) INTO v_count
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'checkout_idempotency'
    AND grantee IN ('anon', 'authenticated');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'checkout_idempotency is reachable by a client role';
  END IF;
  RAISE NOTICE 'PASS checkout_idempotency is private to its RPC.';

  -- 7. RLS must remain enabled on every public table.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_extra
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

  IF v_extra IS NOT NULL AND cardinality(v_extra) > 0 THEN
    RAISE EXCEPTION 'RLS is disabled on: %', array_to_string(v_extra, ', ');
  END IF;
  RAISE NOTICE 'PASS row level security is enabled on every public table.';
END $$;

ROLLBACK;

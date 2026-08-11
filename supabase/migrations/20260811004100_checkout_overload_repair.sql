-- Repair installations made before the Financial Entitlements migration
-- removed the legacy seven-argument checkout overload. The canonical
-- nine-argument signature has defaulted final arguments and is backwards
-- compatible on its own; keeping both signatures makes seven-argument POS
-- calls ambiguous in PostgreSQL.
BEGIN;

DROP FUNCTION IF EXISTS public.process_checkout_v1(
  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB
);
DROP FUNCTION IF EXISTS public.process_checkout_v1(
  UUID, UUID, UUID, TEXT, NUMERIC, BOOLEAN, JSONB, TEXT
);

COMMIT;

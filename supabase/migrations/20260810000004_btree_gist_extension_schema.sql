-- Keep btree_gist outside the exposed public schema.
-- Fresh environments install it into extensions in 00003; this migration
-- safely repairs environments where an earlier 00003 run installed it in public.

BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  v_extension_schema text;
BEGIN
  SELECT n.nspname
  INTO v_extension_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'btree_gist';

  IF v_extension_schema IS NOT NULL AND v_extension_schema <> 'extensions' THEN
    ALTER EXTENSION btree_gist SET SCHEMA extensions;
  END IF;
END;
$$;

COMMIT;

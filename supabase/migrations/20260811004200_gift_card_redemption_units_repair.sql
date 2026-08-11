-- Repair the first Financial Entitlements deployment: a value-based gift-card
-- redemption must carry NULL units, never zero. Zero is not a valid package
-- unit count and would otherwise invoke the package-unit trigger path.
BEGIN;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.process_checkout_v1(uuid,uuid,uuid,text,numeric,boolean,jsonb,text,jsonb)'::regprocedure
  ) INTO v_definition;

  IF position('v_ent_units := 0;' IN v_definition) > 0 THEN
    v_definition := replace(v_definition, 'v_ent_units := 0;', 'v_ent_units := NULL;');
    EXECUTE v_definition;
  END IF;
END $$;

COMMIT;

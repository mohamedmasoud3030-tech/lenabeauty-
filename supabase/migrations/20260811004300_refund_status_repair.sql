-- Repair the first Financial Entitlements deployment: the balance trigger
-- must include the current REFUND row when deriving the final lifecycle state.
BEGIN;

DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'app_private.maintain_entitlement_balance_v1()'::regprocedure
  ) INTO v_definition;

  IF position('v_refund_total := v_refund_total + CASE WHEN NEW.entry_type = ''REFUND'' THEN NEW.amount ELSE 0 END;' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      '  IF v_balance < -0.0005 THEN',
      '  v_refund_total := v_refund_total + CASE WHEN NEW.entry_type = ''REFUND'' THEN NEW.amount ELSE 0 END;' || E'\n\n' || '  IF v_balance < -0.0005 THEN'
    );
    EXECUTE v_definition;
  END IF;
END $$;

COMMIT;

-- Delivery hardening: this release is staff-only.  The public booking landing
-- is intentionally disconnected, so no SECURITY DEFINER RPC may be callable
-- by an anonymous browser.
DO $$
DECLARE
  routine REGPROCEDURE;
BEGIN
  FOR routine IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', routine);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', routine);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', routine);
  END LOOP;
END
$$;

-- These two private helpers are evaluated *inside* RLS policies.  Anonymous
-- callers receive an empty membership result, but PostgreSQL still needs
-- EXECUTE in order to evaluate the policy and safely return zero rows.
GRANT EXECUTE ON FUNCTION app_private.user_center_ids() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_center_member(UUID) TO anon, authenticated;

-- Lock down name resolution for application-owned routines.  This removes
-- role-controlled search_path from trigger and privileged function execution.
DO $$
DECLARE
  routine REGPROCEDURE;
BEGIN
  FOR routine IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'app_private')
      AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, public, app_private', routine);
  END LOOP;
END
$$;

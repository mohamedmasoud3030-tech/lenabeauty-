# Rollback — `20260810000005_security_hardening_auth.sql`

Use only after stopping writes and taking a verified backup. This rollback
removes the security hardening; it does not alter any business row.

```sql
BEGIN;

-- 1. Restore default PUBLIC EXECUTE is intentionally NOT done here: the
--    delivery-hardening migration (20260809000001) already kept the
--    whitelist surface minimal. Re-running that migration's grant sweep
--    restores its exact privilege set.

-- 2. Restore storage policies to the pre-hardening (unscoped) definitions.
DROP POLICY IF EXISTS center_assets_member_select ON storage.objects;
DROP POLICY IF EXISTS center_assets_member_insert ON storage.objects;
DROP POLICY IF EXISTS center_assets_member_update ON storage.objects;

CREATE POLICY center_assets_read ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'center-assets');
CREATE POLICY center_assets_write ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'center-assets');
CREATE POLICY center_assets_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'center-assets')
  WITH CHECK (bucket_id = 'center-assets');

-- 3. Restore center_settings member DELETE capability.
DROP POLICY IF EXISTS center_settings_select ON public.center_settings;
DROP POLICY IF EXISTS center_settings_insert ON public.center_settings;
DROP POLICY IF EXISTS center_settings_update ON public.center_settings;
CREATE POLICY center_settings_select ON public.center_settings
  FOR SELECT USING (center_id = ANY (app_private.user_center_ids()));
CREATE POLICY center_settings_write ON public.center_settings
  FOR ALL
  USING (center_id = ANY (app_private.user_center_ids()))
  WITH CHECK (center_id = ANY (app_private.user_center_ids()));

-- 4. Re-grant anon table access (if the anonymous surface is re-enabled).
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;

-- 5. Re-apply the 20260809000001 sweep to restore its grants (it grants
--    EXECUTE to authenticated for every SECURITY DEFINER routine, including
--    the public booking / client-portal RPCs).
--    NOTE: this re-opens the booking RPCs to any authenticated user.

-- 6. Auth.config changes are dashboard/platform settings; revert them in
--    Authentication -> Providers -> Email -> Password security.

-- Do NOT drop app_private.storage_path_center_id: it is a pure helper and
-- other future policies may reference it.

COMMIT;
```

## Verification after rollback

1. Confirm the storage policies are the unscoped `center_assets_*` versions.
2. Confirm `center_settings_write` FOR ALL policy is back.
3. Confirm anon can access public tables again (only if the anonymous
   surface was re-enabled intentionally).
4. Re-run `supabase/tests/20260810000005_security_hardening.sql` — it must
   now FAIL on the privilege-boundary assertions (expected after rollback).

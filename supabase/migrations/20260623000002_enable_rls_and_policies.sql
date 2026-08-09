-- LenaBeauty — retired legacy RLS migration (intentionally a no-op)
--
-- This file used to reference `center_memberships.user_id`, while the initial
-- schema has always used `center_memberships.profile_id`.  Since migrations are
-- run lexically, that made a clean database bootstrap fail before the correct
-- RLS migration could run.
--
-- Canonical RLS policy migration:
--   20260628000001_enable_rls.sql
--
-- Keep this timestamped file rather than deleting it: a migration runner may
-- already have recorded the version.  The guarded no-op is safe on both a new
-- project and an existing project.  Do not add policies here.
DO $$
BEGIN
  RAISE NOTICE 'Skipping retired legacy RLS migration 20260623000002; canonical RLS follows in 20260628000001.';
END
$$;

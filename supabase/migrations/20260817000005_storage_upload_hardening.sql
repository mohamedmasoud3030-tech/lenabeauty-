-- Harden the private center-assets bucket at the server boundary.
-- Browser validation is not a security boundary: direct Storage API callers
-- must still be constrained by bucket metadata and ADMIN-scoped object policy.

BEGIN;

UPDATE storage.buckets
SET
  file_size_limit = LEAST(COALESCE(file_size_limit, 2097152), 2097152),
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
WHERE id = 'center-assets';

-- Keep the authorization contract explicit and idempotent. These policies were
-- introduced by the authorization repair; recreating them here ensures the
-- bucket upload boundary cannot drift back to membership-only writes.
DROP POLICY IF EXISTS center_assets_admin_insert ON storage.objects;
DROP POLICY IF EXISTS center_assets_admin_update ON storage.objects;

CREATE POLICY center_assets_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.has_center_role(
      app_private.storage_path_center_id(name),
      ARRAY['ADMIN']
    )
  );

CREATE POLICY center_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.has_center_role(
      app_private.storage_path_center_id(name),
      ARRAY['ADMIN']
    )
  )
  WITH CHECK (
    bucket_id = 'center-assets'
    AND app_private.storage_path_center_id(name) IS NOT NULL
    AND app_private.has_center_role(
      app_private.storage_path_center_id(name),
      ARRAY['ADMIN']
    )
  );

COMMIT;

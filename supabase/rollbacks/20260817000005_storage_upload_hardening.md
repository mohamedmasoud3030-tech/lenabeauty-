# Rollback / forward-repair — center-assets upload hardening

Migration: `20260817000005_storage_upload_hardening.sql`

## What it changes

- Caps `center-assets` objects at 2 MiB.
- Allows only JPEG, PNG and WebP MIME types at the Storage server boundary.
- Reasserts ADMIN-only insert/update policies scoped to the object's center path.
- Does not delete or rewrite existing objects.

## Before applying remotely

Run on Demo/Staging only after explicit approval. Preserve the current bucket metadata:

```sql
select id, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'center-assets';
```

Also list any current logo content types/sizes. Existing objects are not changed by this migration, but future replacement uploads outside the new contract will be rejected.

## Emergency rollback

Use the values captured above. If the bucket previously had no limits:

```sql
begin;
update storage.buckets
set file_size_limit = null,
    allowed_mime_types = null
where id = 'center-assets';
commit;
```

Do not loosen the ADMIN/center-scoped object policies merely to bypass an upload error. Prefer forward repair of the client MIME/size validation or the explicitly approved bucket contract.

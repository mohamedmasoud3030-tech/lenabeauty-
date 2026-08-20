# File & Media System Specification — LenaBeauty

**Version:** 1.0  
**Date:** 2026-08-20  
**Status:** Approved for repository-side implementation; no production-bucket changes.

---

## 1. Design Principles

1. **Private by default** — The `center-assets` bucket is private (`public = false`). All access goes through server-governed signed URLs or member-scoped RLS. No content is ever made public to simplify access.
2. **Server-enforced type & size** — Client validation is UX convenience only. The bucket has `allowed_mime_types` and `file_size_limit` at the storage layer. Application-level validation runs before every upload attempt.
3. **No base64 in the database** — Image data is stored in Supabase Storage, not in the `image_url` column. The column holds a storage object path; signed URLs are generated at read time.
4. **Path traversal protection** — All object paths are constructed server-side from known center_id + entity type + safe filename. User-supplied path segments are never trusted.
5. **Upsert for single-instance assets** — Logo and center-branding images use `upsert: true` with a stable path so replacements do not accumulate orphans.
6. **Signed URL lifetime** — Short-lived (1 hour) signed URLs for private bucket access. Never stored in the database. Generated on read.
7. **No paid media services** — Supabase Storage (included in any paid plan tier) satisfies all current needs. No external image transformation/CDN provider is added without owner approval.

---

## 2. Resource Matrix

| Resource | Bucket | Path Pattern | Access | Type Allowlist | Max Size | Max Count | Retention |
|---|---|---|---|---|---|---|---|
| Center logo | `center-assets` | `{centerId}/logo-current` | ADMIN write, member read | jpeg, png, webp | 2 MB | 1 (upsert) | Forever (replaced in place) |
| Service file images | `center-assets` | `{centerId}/service-files/{fileId}/{kind}-{sortOrder}` | Member write & read | jpeg, png, webp | 5 MB | 20 per service file | Until service file deleted |
| Branding logo (base64 fallback) | localStorage | `lenabeauty_logo` | Same origin only | base64 from upload | 2 MB | 1 | Until explicitly cleared |

---

## 3. Access Policy

### 3.1 Storage Bucket: `center-assets`

```
INSERT (upload object):
  Condition: bucket_id = 'center-assets' AND
             storage_path_center_id(name) IS NOT NULL AND
             has_center_role(storage_path_center_id(name), ARRAY['ADMIN'])
  Note: Logo is ADMIN-only. Service file images are member-write.

SELECT (read object):
  Condition: bucket_id = 'center-assets' AND
             storage_path_center_id(name) IS NOT NULL AND
             is_center_member(storage_path_center_id(name))

UPDATE (replace object):
  Condition: same as INSERT (ADMIN-only for now)

DELETE (remove object):
  Condition: same as INSERT (ADMIN-only — service file deletions
             go through the RPC which also removes the file)
```

### 3.2 Signed URL Generation

All reads from the private bucket go through `resolveCenterAssetUrl()` which calls Supabase Storage's `createSignedUrl(path, 3600)`. The signed URL is:
- Generated client-side using the Supabase JS client (anon key has `storage.objects.select` through RLS)
- Valid for 1 hour
- Never stored in the database
- Never logged

---

## 4. Allowed Types & Size Limits

| Layer | Enforced At | Mechanism |
|---|---|---|
| Storage bucket | Supabase (server) | `allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp']`, `file_size_limit = 2097152` (2 MB) |
| Application (uploadLogo) | Server RPC | JS `Set` check on `file.type`, `file.size` check |
| Application (service file) | Client UI | Before upload dialog: type check + size check |
| Application (service file) | Server RPC | RPC validates MIME from `contentType` parameter, rejects non-image |

---

## 5. Filename Policy

| Aspect | Rule |
|---|---|
| Logo path | `{centerId}/logo-current` (no extension, stable, upsert) |
| Service file image path | `{centerId}/service-files/{serviceFileId}/{imageKind}-{sortOrder}-{uuid}` |
| User-controlled filenames | **Never trusted.** The storage path is constructed from known IDs only. Original filename is discarded. |
| Path separators | Only `/` allowed, no `..`, no null bytes |
| Character set | Lowercase hex UUIDs and alphanumeric segments only |

---

## 6. Upload Flow

```
[User selects file]
  → Client validation: type in [jpeg, png, webp] AND size ≤ limit
  → Show preview thumbnail
  → On submit:
    → Supabase storage.from('center-assets').upload(path, file, { upsert, contentType })
    → On success: store path in DB column (logo_path / image_url)
    → On failure: show error with retry option
    → Generate signed URL for display
```

### 6.1 Progress & Cancellation

For the logo upload (single file, small): no progress bar — upload is fast (< 2 MB).
For service file images (potential multiple images): `SupabaseStorageFile` supports abort via `AbortController`:
- Pass signal to `upload()` call
- Cancel button calls `controller.abort()`
- On abort: remove any partially-uploaded object (future enhancement)

### 6.2 Retry

- Automatic: network error during upload triggers one retry with 2-second delay
- Manual: user sees error toast with "Retry" button

---

## 7. Delete / Replace Flow

### 7.1 Logo Replacement

Uses `upsert: true` with stable path `{centerId}/logo-current`. Supabase Storage replaces the object in place. No orphan accumulates.

### 7.2 Service File Deletion

When a service file is deleted:
1. RPC `delete_service_file_v1` is called
2. RPC deletes all `service_file_images` rows (CASCADE)
3. RPC removes the associated objects from `center-assets` storage bucket
4. All within a single transaction

### 7.3 Orphan Prevention

| Strategy | Details |
|---|---|
| Upsert for singletons | Logo uses stable path with upsert |
| Cascading deletion | Service file deletion removes images from storage |
| DB-level cascade | `service_file_images.service_file_id` has `ON DELETE CASCADE` |

---

## 8. UX States

Every upload/view component handles:

| State | Handling |
|---|---|
| **No file** | "No logo uploaded yet" with upload button |
| **Selecting** | Native file picker with `accept="image/jpeg,image/png,image/webp"` |
| **Preview** | Thumbnail of selected image before upload |
| **Uploading** | Disabled button with spinner + "Uploading..." (for logo); progress bar for multiple |
| **Upload success** | Replace preview with uploaded version; toast |
| **Upload failure** | Error message with Retry button |
| **Wrong type** | Inline validation message before upload attempt |
| **File too large** | Inline validation message showing max size |
| **Duplicate** | Logo uses upsert so no conflict; service files use unique paths |
| **Delete** | Confirmation dialog before deletion |

---

## 9. Tests

### 9.1 Unit Tests

1. Logo upload — valid type (jpeg, png, webp) passes validation
2. Logo upload — invalid type (pdf, gif, svg) fails validation
3. Logo upload — file size 0 fails validation
4. Logo upload — file size > 2 MB fails validation
5. Logo upload — exactly 2 MB passes validation
6. Storage path construction — no path traversal possible
7. Storage path construction — UUID prefix extracted correctly

### 9.2 Integration Tests (RPC-level)

8. Logo upload (authorized ADMIN) — succeeds
9. Logo upload (unauthorized STAFF) — fails
10. Logo upload (invalid MIME through direct API) — fails at storage bucket level
11. Service file creation — valid data succeeds
12. Service file creation — oversized base64 rejected
13. Service file deletion — cascades to storage objects

### 9.3 Security Tests (via audit)

14. Anonymous user cannot list bucket objects
15. Cross-center user cannot read another center's objects
16. STAFF member cannot upload to bucket (ADMIN-only insert)
17. Path traversal attempt in storage path returns null from `storage_path_center_id`
18. No secrets in signed URLs or logs

---

## 10. Cost Controls

| Item | Cost | Control |
|---|---|---|
| Supabase Storage | Included in any paid plan | None (no separate service) |
| Storage volume | ~$0.021/GB/month on Supabase | Logo: ~100 KB; Service files: ~5 MB each max |
| Bandwidth | Included in plan | Minimal — staff-only usage |
| **No external service cost** | $0 | We use Supabase Storage, not a paid media service |

---

## 11. Current State Corrections

### 11.1 Service File Images → Move to Storage

**Current:** `create_service_file_v1` RPC accepts base64 image strings in the `image_url` column. This stores multi-MB strings in the database, bypasses storage bucket policies, and wastes bandwidth.

**Target:** Upload images to `center-assets` bucket first, then store only the storage path in `image_url`.

**Status:** Implemented in this migration.

### 11.2 Logo Storage Path

Already correct: `{centerId}/logo-current` with upsert. No change needed.

### 11.3 Bucket Policies

Verified correct:
- `file_size_limit = 2097152`
- `allowed_mime_types = ['image/jpeg', 'image/png', 'image/webp']`
- ADMIN-only INSERT/UPDATE
- Member-scoped SELECT
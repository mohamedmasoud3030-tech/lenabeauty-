# Secure Membership Bootstrap Procedure

Membership provisioning is a server-side operation. The browser has SELECT-only access to its own `center_memberships` rows and cannot grant or change roles.

## Provisioning the first administrator

1. Create the user in **Supabase Dashboard → Authentication → Users** and copy the UUID.
2. Apply all canonical migrations in `supabase/migrations/` in filename order.
3. Edit the placeholder UUID in `20260628000002_admin_bootstrap.sql` and run that manual bootstrap in the Supabase SQL editor.
4. Sign out and sign in again so the new server-owned `app_metadata.role` is present in the access token.

The bootstrap creates the profile and membership and sets both authoritative role locations:

- `center_memberships.role` — center-scoped database authorization;
- `auth.users.raw_app_meta_data.role` — server-owned role used by the frontend route guards.

Never store an authorization role in `user_metadata`: authenticated users can edit their own `user_metadata`.

## Adding another member

Run this only in the Supabase SQL editor or through a trusted service-role provisioning process. Replace the placeholders and choose `ADMIN`, `MANAGER`, or `STAFF`.

```sql
BEGIN;

INSERT INTO public.profiles (id, full_name)
VALUES ('USER_UUID', 'Display name')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.center_memberships (profile_id, center_id, role)
VALUES ('USER_UUID', 'CENTER_ID', 'STAFF')
ON CONFLICT (profile_id, center_id) DO UPDATE SET role = EXCLUDED.role;

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'STAFF')
WHERE id = 'USER_UUID';

COMMIT;
```

The current UI role is global while database roles are center-scoped. In a multi-center deployment, assign the same role across a user's memberships until the UI supports displaying a role per active center.

## Security constraints

- No public or authenticated RPC grants memberships.
- `center_memberships` has no client INSERT/UPDATE/DELETE policy.
- Automated provisioning requires a server-only service-role key; never expose that key through a `VITE_*` variable.
- Role changes require a fresh Auth token (sign out/in or token refresh).

# Secure Membership Bootstrap Procedure

To prevent unauthorized access while maintaining strict RLS, the first administrator must be provisioned via a controlled server-side step.

## Provisioning the First Admin

Since RLS is enabled and `center_memberships` is protected, you cannot use the client-side API to grant the first membership. Follow these steps:

1. **Create the User**: Sign up the first user via the application's sign-up flow or the Supabase Auth dashboard.
2. **Identify User UUID**: Go to the Supabase Dashboard -> Authentication -> Users and copy the UUID of the user.
3. **Run Bootstrap SQL**: Use the SQL Editor in the Supabase Dashboard to run the following script (replace placeholders):

```sql
-- 1. Create the Center
INSERT INTO public.centers (name)
VALUES ('My Salon Name')
RETURNING id; -- Note this ID as CENTER_ID

-- 2. Grant Admin Membership
-- Replace 'USER_UUID' and 'CENTER_ID' with real values
INSERT INTO public.center_memberships (user_id, center_id, role)
VALUES ('USER_UUID', 'CENTER_ID', 'owner');

-- 3. Initialize Settings
INSERT INTO public.center_settings (center_id, name)
VALUES ('CENTER_ID', 'My Salon Name');
```

## Secure Design Constraints

- **No Client-Side Bypass**: There is no RPC or API endpoint that allows an un-membered user to join a center.
- **Service Role Only**: Any automated provisioning must use the `service_role` key, which bypasses RLS.
- **RLS Enforcement**: Once the first admin is provisioned, all subsequent membership grants must also go through the Supabase Dashboard SQL Editor or a service-role key. There is no in-app invite workflow; the application does not expose an endpoint for granting memberships.

## Adding Further Members

All subsequent memberships are added the same way: via the Supabase Dashboard SQL Editor or a script using the service-role key. Replace `USER_UUID`, `CENTER_ID`, and `role` as appropriate:

```sql
INSERT INTO public.center_memberships (user_id, center_id, role)
VALUES ('USER_UUID', 'CENTER_ID', 'staff')
ON CONFLICT (user_id, center_id) DO UPDATE SET role = EXCLUDED.role;
```

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
- **RLS Enforcement**: Once the first admin is provisioned, they can use the application to invite other members, as their existing membership will allow them to `INSERT` into `center_memberships` (provided a policy is added for that - currently policies only allow `SELECT`).

## Inviting New Members (Admin Workflow)

To allow admins to invite others, add this policy:

```sql
CREATE POLICY "Admins can manage memberships" ON public.center_memberships
FOR ALL TO authenticated
USING (app_private.has_center_role(center_id, ARRAY['owner', 'admin']::public.member_role))
WITH CHECK (app_private.has_center_role(center_id, ARRAY['owner', 'admin']::public.member_role));
```

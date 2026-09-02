# Supabase Staging Migration Plan

This structured plan safely migrates a fresh or drifted remote environment to meet the foundational DML bounded increment strictly for `Customers` and `Services`.

## 1. Safety Designation
These steps are **SAFE TO APPLY TO STAGING**. Applying these to a blank Staging project ensures the database prepares itself strictly according to local RLS boundaries.

## 2. Schema Migration Order
Execute DDL schema structures in relationship-safe order (parents before children):
1. `centers`
2. `profiles`
3. `center_memberships`
4. `center_settings`
5. `employees`
6. `service_categories`
7. `services`
8. `products`
9. `customers`
10. `appointments`
11. `invoices`
12. `invoice_items`
13. `payments`
14. `expenses`
15. `inventory_movements`

## 3. Private Helper Schema Creation
```sql
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO postgres, authenticated;
REVOKE ALL ON SCHEMA app_private FROM public, anon;
```

## 4. Center ID Helper Function Order
Apply the `app_private.get_current_user_center_id()` function ensuring `SECURITY DEFINER` and `SET search_path = public, auth` options are correctly hardcoded. Ensure `EXECUTE` privileges are granted strictly to `authenticated`.

## 5. Triggers Authorization
Implement the Tenant Security bounds directly:
1.  Apply `app_private.set_tenant_id_from_context()`.
2.  Bind `BEFORE INSERT` onto `customers`.
3.  Bind `BEFORE INSERT` onto `services`.
4.  Apply `app_private.prevent_tenant_reassignment()`.
5.  Bind `BEFORE UPDATE` onto `customers`.
6.  Bind `BEFORE UPDATE` onto `services`.

## 6. RLS Enablement
Explicitly process `ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;` against all 15 operational data models.

## 7. RLS Policies
Apply the SELECT, INSERT, UPDATE, DELETE policies defined in `docs/supabase-rls-draft.sql` ensuring `center_id = app_private.get_current_user_center_id()` operates correctly.

## 8. Rollback Steps
If migrations fail or corruption is detected:
1. `DROP SCHEMA app_private CASCADE;`
2. Drop all structural tables starting with the lowest child.
3. Reprovision from the default Supabase initialization state.

## 9. Smoke Tests (Post-Deployment)
1. Verify an anonymous user cannot query `customers`.
2. Verify an `authenticated` user with no `center_memberships` cannot execute an `INSERT` against `customers`.

## 10. Cross-Center Rejection Tests (Post-Deployment)
1. Insert a Customer with `center_id` mapped to UUID 'A' using User 1 (Center A).
2. Use User 2 (Center B) to attempt an `UPDATE` on the Customer UUID from step 1.
3. Validate Supabase correctly drops the query silently via RLS yielding zero rows updated, rather than leaking the existence.

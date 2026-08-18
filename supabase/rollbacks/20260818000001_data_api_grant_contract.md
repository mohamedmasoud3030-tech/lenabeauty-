# Rollback / forward-repair — explicit Data API grant contract

Migration: `20260818000001_data_api_grant_contract.sql`

This migration makes the Data API privilege contract explicit, revokes future auto-exposure for client roles, and reasserts the existing containment boundaries. It changes no business rows, RLS policies, functions, triggers, constraints, or indexes. `anon` gains nothing.

Offline verification:

```bash
npx vitest run src/__tests__/supabase.data-api-grant-contract.test.ts
```

Live verification after an approved Demo apply:

```sql
SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
```

Expected: no `anon` table privileges; `authenticated` has broad SELECT, INSERT/UPDATE only on explicitly operational master tables, and DELETE nowhere.

## Emergency rollback

To restore the previous implicit defaults for future objects only:

```sql
BEGIN;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
COMMIT;
```

Do not use a blanket `GRANT ALL ON ALL TABLES ... TO anon, authenticated`; that would break the established security boundaries.

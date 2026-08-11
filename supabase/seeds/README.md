# Supabase seeds — DEMO / STAGING ONLY

Files in this directory are **deliberately outside `supabase/migrations/`**.
They are never applied by the migration chain and must never be applied to a
production database.

| File | Contents | Gate |
| --- | --- | --- |
| `20260810_lena_service_catalog_demo.sql` | Arabic service catalog for demo/staging | `SET app.seed_environment = 'demo'` (or `'staging'`) **and** `SET app.seed_center_id = '<uuid>'` in the same session, or the script aborts before any DML |

## Rules (production safety)

1. **Migrations are the only schema source of truth.** Seeds contain data
   only — no `CREATE TABLE`, no `ALTER TABLE`, no RPC definitions.
2. **Seeds never touch production.** The explicit environment gate above is
   enforced inside the seed file itself; a session that forgot the `SET`
   statements fails closed.
3. **Demo data stays out of production bootstrap.** The production bootstrap
   procedure (`docs/ENVIRONMENT_SEPARATION.md`) applies migrations only and
   seeds no users, services, customers, transactions, or payments.
4. If a new demo dataset is added, it must follow the same pattern: gated,
   idempotent, and placed here — never in `supabase/migrations/`.

## Verification

The phase-3 migration test suite asserts that no canonical migration inserts
demo business rows; the phase-4 release gate re-runs it (`npm test`). You can
also grep the migration chain yourself:

```bash
grep -l "INSERT INTO public.services\|INSERT INTO public.customers" supabase/migrations/ || echo "clean"
```

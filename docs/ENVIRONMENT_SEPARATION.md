# Environment Separation — LenaBeauty

**Updated:** 2026-08-16

## Current authoritative state

| Role | Project | Ref | Data policy |
|---|---|---|---|
| Lena Demo/Staging | `Lena beauty` | `tuzzvqsnbtzvkffmazyf` | fictional demo/acceptance data only |
| Unrelated product — never use | `starting` | `livpmxwwxsfnaceczyth` | outside LenaBeauty |
| Lena Production | not provisioned | none | no production customer data exists |

The public Lena trial deployment currently targets `tuzzvqsnbtzvkffmazyf`. A production-optimized Vite bundle is only a build mode; it does not make its database a Production environment. Until a separate Production project is explicitly provisioned, the embedded fallback is classified as `staging`.

## Runtime selection

`VITE_ENVIRONMENT` accepts `development`, `staging`, or `production`.

- Explicit configuration always wins.
- Local/test builds default to `development`.
- The current optimized trial build defaults to `staging` and uses the Lena Demo fallback.
- A future Production deployment must set explicit `VITE_*` values for its separate project. It must not reuse the Demo fallback.

Required browser configuration:

- `VITE_DATA_BACKEND=supabase`
- `VITE_ENVIRONMENT=staging` for the current Lena Demo
- `VITE_BRANCH_MODE=single`
- `VITE_SUPABASE_URL=https://tuzzvqsnbtzvkffmazyf.supabase.co`
- the Demo publishable key
- the primary Demo center UUID

Service-role keys, database passwords, and Supabase management tokens are server-only and must never use a `VITE_*` name.

## Schema and data boundaries

- `supabase/migrations/*.sql` is the only canonical DDL chain.
- `supabase/seeds/` is Demo-only and must remain gated/idempotent.
- Demo may retain fictional services, customers, staff, appointments, inventory, and valid checkout history.
- Real customer data must not be introduced until a separate Production environment and migration plan are approved.
- `livpmxwwxsfnaceczyth` must never be linked, migrated, seeded, or tested by LenaBeauty tooling.

## Future Production bootstrap

1. Provision a separate Supabase project after explicit authorization.
2. Apply the canonical migrations without Demo seeds.
3. Create server-governed admin membership and Auth `app_metadata.role`.
4. Enable managed Auth protections and review security advisors.
5. Configure explicit Production Vercel variables.
6. Verify the project ref differs from both current known projects before any migration command.

## Secret hygiene

- Publishable/anon browser configuration is public by design.
- Service-role keys, database passwords, management tokens, and user passwords must stay in secure runtime storage.
- `src/__tests__/secrets-scan.test.ts` guards tracked files against privileged credentials.

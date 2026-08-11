# Environment Separation — LenaBeauty

**Phase:** Production Readiness & Security Hardening (2026-08-10)

This document defines the explicit environment model, the demo/staging vs
production boundaries, and the production bootstrap procedure. It prepares the
codebase for a clean future Production environment **without creating any
production data** (no second Supabase project was created).

## 1. Explicit environment model

Every runtime resolves to exactly one environment:

| Environment | Selection | Supabase target | Demo data |
| --- | --- | --- | --- |
| `development` | `VITE_ENVIRONMENT=development`, or unset in dev/test builds | your local `.env` project | none (you load what you want) |
| `staging` | `VITE_ENVIRONMENT=staging` | the staging/demo Supabase project | yes (catalog seed + demo rows) |
| `production` | `VITE_ENVIRONMENT=production`, or unset in prod builds (derived) | the canonical production project | **never** |

`VITE_ENVIRONMENT` is validated in `src/config/env.ts` (`development |
staging | production`; anything else fails fast). It is optional because the
build already derives `production` for prod builds and `development`
otherwise, so a misconfigured deployment fails loudly instead of silently
routing to the wrong project. Staging deployments should set
`VITE_ENVIRONMENT=staging` explicitly.

**Production fallbacks are production-only.** `src/config/env.ts` keeps the
canonical single-branch deploy values (Supabase URL, publishable/anon key,
seed center UUID) as fallbacks **only in production builds**. They are never
used in development or staging builds — a staging deploy without explicit
variables fails at boot rather than touching the canonical production
project.

## 2. No hardcoded environment ambiguity

- All environment inputs flow through `src/config/env.ts` and fail fast.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is the browser-safe anon key; `sb_secret_*`
  (service-role) keys are rejected by validation and by the preflight script.
- `vercel.json` ships no secrets; deployment variables are set in the Vercel
  dashboard only.

## 3. Migrations are the only schema source of truth

- `supabase/migrations/*.sql` (lexically ordered) is the **only** DDL source.
- `docs/*.sql` files are historical reference material, not deployment
  source; `supabase/rollbacks/` documents how to revert a migration.
- The migration chain is verified by `src/__tests__/supabase.migration-chain.test.ts`
  and `scripts/supabase-live-preflight.mjs`.

## 4. Demo seed/data separation

- Demo data lives only in `supabase/seeds/` (see `supabase/seeds/README.md`).
- Seeds are gated by `SET app.seed_environment = 'demo'|'staging'` +
  `SET app.seed_center_id = '<uuid>'` and abort without both.
- No canonical migration inserts demo users, services, customers,
  transactions, or payments (regression-tested).
- The current staging/demo Supabase database retains its demo data and is the
  target for all migration/test work in this phase.

## 5. Production bootstrap procedure (no demo data)

1. Create the production Supabase project (explicit authorization required —
   not done in this phase).
2. Apply `supabase/migrations/*.sql` in lexical order (or `supabase db push`
   from a linked branch).
3. Create the first admin user via Authentication → Users, then run
   `20260628000002_admin_bootstrap.sql` with that user's UUID.
4. Configure Auth protections (leaked-password protection, reauthentication
   requirement) — the phase-5 migration attempts this via `auth.config`; the
   dashboard must confirm.
5. Configure Vercel environment variables (never commit them).
6. Do **not** run any file from `supabase/seeds/`.

## 6. Required environment variables / secrets

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_DATA_BACKEND` | yes | must be `supabase` |
| `VITE_SUPABASE_URL` | yes | project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | anon/publishable key (never the secret key) |
| `VITE_CENTER_ID` | yes (single-branch) | seed center UUID |
| `VITE_BRANCH_MODE` | yes | `single` (v1.0) |
| `VITE_ENVIRONMENT` | no | `development` \| `staging` \| `production` (derived when unset) |
| `SUPABASE_SERVICE_ROLE_KEY` | no (server-only, never in VITE_*) | used only by server-side provisioning scripts |

Values are documented but never committed; see `.env.example`. The secrets
scan (`src/__tests__/secrets-scan.test.ts`) fails the test suite if a
service-role key, private key, or real postgres password appears in the tree.

## 7. Secret hygiene verification

- `src/__tests__/secrets-scan.test.ts` scans the working tree for
  `sb_secret_*`, `role=service_role` JWTs, private-key material, and postgres
  URLs with embedded passwords (allow-listing the deliberate defensive
  references in `env.ts`, `substrate.test.ts`, and the preflight script).
- The publishable anon key in `src/config/env.ts` is public by design.
- Git history is shallow (single squashed commit) in this checkout; the scan
  covers all files currently accessible. If the upstream history is ever
  made available, re-run the scan and rotate any key that ever appeared in
  history (see `docs/PRODUCTION_READINESS.md`, "Rotate the leaked Supabase
  publishable key").

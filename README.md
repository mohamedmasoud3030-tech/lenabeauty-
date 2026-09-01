# LenaBeauty — Salon Management PWA

A salon/spa management Progressive Web App for the Omani market, built with React 19, TypeScript, Vite 6, Tailwind CSS v4, and a live **Supabase** backend (Auth + Postgres + Storage + RPC).

> Runtime status: Supabase-backed only — there is no fake/offline operating data adapter. Canonical Demo/Staging deployment and database contracts are maintained separately from any future protected Production environment.

## Architecture

Ports & adapters:

- `src/domain/` — entities, pure business rules, repository ports and `Result<T, E>`.
- `src/application/` — DTOs and error mapping.
- `src/infrastructure/supabase/` — Supabase adapters that implement the domain ports.
- `src/app/composition/` — lazy repository bundle / use-case facade.
- `src/pages/`, `src/ui/`, `src/shared/` — React UI, layout and reusable components.
- `src/config/env.ts` — hard environment validation; boot fails closed on invalid config.

The current operating flow connects Visit lifecycle → POS → Checkout with Beauty Passport, Wallet, Service Recipes, Retention and Action Center. Checkout and other trusted state transitions remain server-authoritative.

## Tech Stack

- **Vite 6** · **React 19** · **React Router 7** (`HashRouter`)
- **Tailwind CSS v4** · **lucide-react** · **motion** · **recharts**
- **@supabase/supabase-js**
- **i18next / react-i18next** — Arabic (RTL) + English
- **vite-plugin-pwa** (Workbox)
- **Vitest** + Testing Library + PGlite database replay/acceptance

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in the intended Supabase values
npm run dev
```

### Required environment variables

See `.env.example`. Locally these live in `.env`; deployed client variables belong in the deployment environment, not `vercel.json`.

| Variable | Purpose |
|---|---|
| `VITE_DATA_BACKEND` | Must be `supabase` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (never the service-role secret) |
| `VITE_CENTER_ID` | Active center UUID |
| `VITE_BRANCH_MODE` | `single` or `multi` |
| `VITE_ENVIRONMENT` | Optional: `development` \| `staging` \| `production` |
| `VITE_USE_DEMO_CREDENTIALS` | Optional local-development escape hatch only; ignored for Production and must never cause a Production fallback to Demo |

## Supabase setup

`supabase/migrations/` is the only canonical migration source. Apply **every `.sql` migration discovered from that directory in lexical filename order**. Do not deploy from SQL copies under `docs/`; those are historical/reference material.

Important rules:

1. `20260623000001_initial_schema.sql` establishes the base schema/seed center.
2. `20260623000002_enable_rls_and_policies.sql` is retained as a compatibility-safe migration.
3. `20260628000001_enable_rls.sql` establishes the canonical base RLS boundary.
4. `20260628000002_admin_bootstrap.sql` is the **single manual/operator bootstrap** because it requires a real Auth user UUID. It is excluded from automated replay and must be handled deliberately on a fresh project.
5. Continue through **all later filenames present on disk**. Never use a README/runbook “last filename” as the deployment boundary.

As of 2026-09-01 the generated audit discovers 41 migrations: 40 automated + the one manual bootstrap. This number is evidence, not a hard-coded deployment rule. The current Visit/Recipe tail is:

- `20260901100838_visit_lifecycle_recipes.sql`
- `20260901101133_visit_recipe_index_hardening.sql`
- `20260901102643_recipe_write_boundary_hardening.sql`
- `20260901102758_recipe_consumption_aggregation_hardening.sql`

Those migrations add the appointment-aware checkout/Visit lifecycle and Service Recipes, then harden FK access paths, enforce RPC-only recipe writes, and aggregate duplicate service invoice lines before idempotent recipe consumption.

The optional service catalog under `supabase/seeds/` is Demo/Staging data and is not part of the canonical Production migration chain.

### Approval-gated Demo migration sync

`.github/workflows/demo-supabase-migrations.yml` always runs the static application/database gate for PRs and `main`. The **credentialed remote migration job is approval-gated**: it only runs on explicit `workflow_dispatch` when the complete Demo secret set is configured. Ordinary PRs/main pushes do not mutate the hosted database.

The workflow verifies that the target is exactly the canonical Lena Demo project, aligns migration history, applies pending canonical migrations, runs `preflight:supabase`, and executes every rollback-safe `supabase/tests/*.sql` file through `psql`.

Required GitHub Actions secrets for that live Demo job are:

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase management access used by the workflow |
| `SUPABASE_PROJECT_REF` | Explicit linked target project ref |
| `SUPABASE_DB_PASSWORD` | Database password for CLI/psql |
| `DEMO_SUPABASE_PROJECT_REF` | Independent expected Demo ref; must equal the linked target |
| `DEMO_SUPABASE_URL` | Demo API URL |
| `DEMO_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Demo publishable key |
| `DEMO_CENTER_ID` | Canonical Demo center UUID |
| `DEMO_SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by controlled live preflight; never a `VITE_*` value |

If any validation/migration/acceptance step fails, the workflow stops. Seeds are deliberately excluded. A future Production database must use separately protected credentials/workflow controls.

Before release, run:

```bash
npm run preflight:supabase
```

The current preflight verifies the effective September contract, not only the older August checkout foundation: appointment-aware checkout, Visit RPC, recipe tables, RPC-only recipe writes, duplicate-service-line aggregation and internal consumer revocation are all part of the check.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm test
npm run audit:gate
npm run db:types:check
npm run ci:migrations
npm run ci:rpc-check
npm run preflight:supabase
```

The canonical static GitHub gate additionally runs lint, `npm audit --audit-level=low`, and `git diff --check`.

## Current operating contracts

| Area | Backend | Notes |
|---|---|---|
| Auth/session/membership | ✅ Supabase | DB membership/role boundary; invalid authorization fails closed |
| Customers / Beauty Passport | ✅ Supabase | Real customer, appointment, invoice, entitlement and service-file history |
| Appointments / Visit lifecycle | ✅ Supabase + RPC | Server-enforced stages; `READY_FOR_CHECKOUT` hands off to POS; checkout completes the visit |
| POS / invoices / payments | ✅ Atomic idempotent RPC | `process_checkout_idempotent_v1` is the client checkout authority |
| Service Recipes / consumption | ✅ Supabase + RPC | Authorized reads; direct client writes denied; duplicate lines aggregate before idempotent consumption |
| Gift cards / packages / Wallet | ✅ Entitlement ledger | Instruments remain distinct and are redeemed through governed checkout |
| Retention / Action Center | ✅ Derived from real records | Deterministic operational signals, no fabricated predictions |
| Attendance / advances / payroll | ✅ Supabase | Governed staff/ADMIN boundaries and transactional operations |
| WhatsApp / notifications | ⚠️ Manual/scaffolding | Manual `wa.me` handoff; no provider delivery backend |
| Payment provider settings | ⚠️ Metadata only | No live charge/webhook implementation |

## Demo evidence note

The canonical Lena Beauty Demo project ref is `tuzzvqsnbtzvkffmazyf`. During the 2026-09-01 review the four Visit/Recipe migrations above were applied and the hosted schema, grants/RLS, function signatures/definitions and indexes were inspected directly. The GitHub credentialed live job could not be claimed as passed because its full secret set was not configured.

At that time the main Demo center contained services/customers/invoices but no products, appointments or entitlements. Therefore full browser E2E for Visit/Recipes/Wallet requires controlled Demo seed data; empty tables are not treated as acceptance evidence.

## Security notes

- Apply the full canonical migration chain before storing real data.
- Never commit `.env` or secret/service-role keys.
- Recipe table writes are deliberately unavailable to normal client roles; `save_service_recipe_v1` is the governed write path.
- `process_checkout_v1` and `app_private.consume_invoice_recipes_v1` are internal/non-client-executable.
- Security headers (CSP, X-Frame-Options, etc.) are configured in `vercel.json`.

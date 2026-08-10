# LenaBeauty — Salon Management PWA

A single-center salon/spa management Progressive Web App for the Omani market,
built with React 19, TypeScript, Vite 6, Tailwind CSS v4, and a live
**Supabase** backend (Auth + Postgres + Storage + RPC).

> Status: v1.0 in progress. Core CRUD is wired to Supabase. A live Supabase
> connection is required to run — there is no offline/fake operating mode.

## Architecture

Clean / hexagonal architecture (ports & adapters):

- `src/domain/` — entities + repository **ports** (interfaces) and the
  `Result<T, E>` type. No framework or infrastructure code.
- `src/application/` — DTOs and error mapping.
- `src/infrastructure/supabase/` — Supabase **adapters** that implement the
  domain ports (client, mappers, repositories, errors).
- `src/pages/`, `src/ui/`, `src/shared/` — React UI, layout, and reusable
  components.
- `src/config/env.ts` — hard environment validation. Boot fails fast on
  missing/invalid config (no silent fallback).

## Tech Stack

- **Vite 6** (build) · **React 19** + **React Router 7**
- **Tailwind CSS v4** · **lucide-react** · **motion** · **recharts**
- **@supabase/supabase-js** (backend)
- **i18next / react-i18next** — Arabic (RTL) + English
- **vite-plugin-pwa** (Workbox) — installable PWA
- **Vitest** + Testing Library

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in real Supabase values
npm run dev
```

### Required environment variables

See `.env.example`. Locally these live in `.env`; in production set them in the
**Vercel dashboard** (Project → Settings → Environment Variables), not in
`vercel.json`.

| Variable | Purpose |
|---|---|
| `VITE_DATA_BACKEND` | Must be `supabase` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (never the secret key) |
| `VITE_CENTER_ID` | UUID of the center (seeded by the initial migration) |
| `VITE_BRANCH_MODE` | `single` or `multi` (multi-branch lets the operator switch the active center at runtime) |

## Supabase setup

Apply the complete, lexically ordered files in `supabase/migrations/` to a new
**staging** Supabase project. Do not use the old SQL files under `docs/`; they
are historical reference material, not the deployment source.

The deployment-critical steps are:

1. `20260623000001_initial_schema.sql` — base tables, indexes, triggers, and seed center.
2. `20260623000002_enable_rls_and_policies.sql` — retained safe no-op for compatibility.
3. `20260628000001_enable_rls.sql` — canonical RLS policies. **Required before real data.**
4. `20260628000002_admin_bootstrap.sql` — link the real admin UUID and role.
5. Continue through `20260810000003_appointment_overlap_integrity.sql` in filename order. The final steps install the canonical checkout/payment/inventory contract, appointment state machine, duration snapshots, and concurrent-safe staff overlap protection. Apply to Demo/staging first; no migration or seed is applied remotely by this repository checkout.

The optional Arabic service catalog lives under `supabase/seeds/` and is explicitly gated to demo/staging. It is not part of the production migration chain. See `docs/OPERATIONAL_DATA_CONTRACT.md` and the paired rollback runbook under `supabase/rollbacks/`.

Before a release, run `npm run preflight:supabase` with the normal client
variables and a temporary local `SUPABASE_SERVICE_ROLE_KEY`. The script verifies
the canonical chain and, when that key is present, confirms every core table and
the configured center exist remotely. Never place that service-role key in Vercel
or any `VITE_*` variable.

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build (dist/)
npm run preview      # preview the build
npm run typecheck    # tsc --noEmit (0 errors expected)
npm run test         # vitest run
npm run preflight:supabase   # verify live Supabase connectivity
```

## Status of features

| Area | Backend | Notes |
|---|---|---|
| Auth, Customers, Employees, Services, Products, Appointments, Expenses, Invoices/POS, Settings, Dashboard, Reports | ✅ Supabase | Core v1.0 CRUD |
| Attendance, Advances, Payroll, Staff Analytics | ⚠️ Demo only | UI complete but **not** backed by Supabase yet — flagged in-app with a "Demo preview" banner. |
| WhatsApp / notifications | ⚠️ Scaffolding | Service layer present; requires WhatsApp Business API credentials. |

## Security notes

- RLS must be enabled (migration 2) before any real data is stored.
- Never commit `.env` or real keys. If a publishable key was ever committed,
  rotate it in the Supabase dashboard.
- Security headers (CSP, X-Frame-Options, etc.) are configured in `vercel.json`.

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
| `VITE_BRANCH_MODE` | `single` (multi-branch not yet implemented) |

## Supabase setup

Run the migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/20260623000001_initial_schema.sql` — tables, indexes,
   triggers, seed center.
2. `supabase/migrations/20260628000001_enable_rls.sql` — enables Row Level
   Security and tenant-isolation policies. **Required before production.**
3. `supabase/migrations/20260628000002_admin_bootstrap.sql` — links the admin
   auth user to the center and sets their role (edit the UUID first).
4. `supabase/migrations/20260628000003_checkout_rpc.sql` — the POS checkout
   transaction (`process_checkout_v1`). **Required for POS to work.**

> Note: `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` is a superseded draft
> (it assumes schema that doesn't exist) — use migration 4 instead.

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

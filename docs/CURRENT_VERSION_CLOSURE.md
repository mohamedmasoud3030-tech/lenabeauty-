# CURRENT VERSION CLOSURE — v1.0
**Release definition:** Single-customer, single-center Supabase PWA. Real auth. Real CRUD. Live Supabase QA verified. No fake mode.  
**Primary gate:** Live Supabase connection must be established before any customer receives this product.

---

## WHAT IS ALREADY DONE ✅

| Item | Evidence |
|---|---|
| Preview Mode removed | `BackendMode = "supabase"` only · `src/infrastructure/preview/` deleted · `UserRole.PREVIEW` absent · Login page has no preview button |
| Hard config guard | `parseEnv()` throws `EnvironmentConfigurationError` on missing/invalid env |
| All core CRUD adapters | Implemented in `src/infrastructure/supabase/repositories.ts` |
| TypeScript clean | `tsc --noEmit` → 0 errors |
| Tests passing | `vitest run` → 74/74 |
| Build passing | `npm run build` → clean PWA |
| Schema SQL written | `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` finalized |
| QA runbook written | `docs/SUPABASE_LIVE_QA_RUNBOOK.md` |
| Preflight script | `npm run preflight:supabase` |
| Acceptance checklist | `docs/MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` |

---

## MANDATORY GATE — SUPABASE CONNECTION

**This gate must pass before any other v1.0 activity.**  
Estimated time: 45–60 minutes (one sitting).

### Step 1 — Create Supabase Project (5 min)
1. Go to https://supabase.com → sign in
2. Click **"New Project"**
3. Name: `spa-management-prod` (or your preferred name)
4. Region: `eu-south-1` (closest to MENA) or choose your region
5. DB password: generate a strong one, save it securely
6. Wait for initialization (~5 min)

### Step 2 — Copy Credentials (2 min)
In Supabase Dashboard → **Settings → API**:
- Copy **Project URL** (e.g. `https://xxxx.supabase.co`)
- Copy **anon/public key** (starts with `eyJ...`) — NOT the secret key

### Step 3 — Apply Base Schema (10 min)
1. Supabase Dashboard → **SQL Editor** → New Query
2. Paste entire contents of `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql`
3. Click **Run**
4. Verify success:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```
Expected: `appointments`, `center_memberships`, `centers`, `customers`, `employees`, `expenses`, `products`, `profiles`, `services`

### Step 4 — Create Admin User (5 min)
Supabase Dashboard → **Authentication → Users → Add User**:
- Email: `admin@yoursalon.com`
- Password: strong password (save it)
- Do NOT auto-confirm invite — set password directly

### Step 5 — Seed Center (5 min)
SQL Editor → New Query:
```sql
-- Create the center
INSERT INTO public.centers (id, name, currency, center_type)
VALUES (gen_random_uuid(), 'My Salon', 'SAR', 'salon')
RETURNING id;
```
Copy the returned UUID.

```sql
-- Link admin user to center (replace both UUIDs)
INSERT INTO public.center_memberships (user_id, center_id, role)
VALUES (
  '<user-uuid-from-auth-dashboard>',
  '<center-uuid-from-above>',
  'ADMIN'
);
```

### Step 6 — Configure Environment (5 min)
Create `.env.local` in project root (this file is gitignored — never commit it):
```
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...
VITE_CENTER_ID=<center-uuid-from-step-5>
VITE_BRANCH_MODE=single
```

### Step 7 — Run Preflight (5 min)
```bash
npm run preflight:supabase
```
All checks must pass. If any fail, fix before proceeding.

### Step 8 — Boot Verification (10 min)
```bash
npm run dev
```
Open http://localhost:5173
- [ ] Login page loads (no config errors)
- [ ] Login with admin credentials → dashboard appears
- [ ] Page refresh → session restored, no re-login needed
- [ ] Logout → redirected to login

**Acceptance:** All 4 checks above pass. Supabase connection is live.

---

## BLOCKER 2 — Full Live Browser QA

Follow `docs/SUPABASE_LIVE_QA_RUNBOOK.md` completely. Summary:

**Auth**
- [ ] ADMIN login / session restore / logout
- [ ] STAFF login — blocked from `/reports` and `/settings`
- [ ] Wrong credentials → error, not crash

**Core CRUD — each must persist on page reload**
- [ ] Customers: create, read, update, delete
- [ ] Appointments: create, read, update (status), delete
- [ ] Services: create, read, update, delete
- [ ] Employees: create, read, update, delete
- [ ] Products: create, read, update, delete
- [ ] Expenses: create, read, delete

**Dashboard & Reports**
- [ ] Operational counts show real numbers (not 0)
- [ ] Appointment report renders real data
- [ ] Inventory report renders real data
- [ ] Financial metrics → "Backend Required" (not crash)
- [ ] Sales report → "Backend Required" (not crash)

**Error handling**
- [ ] All `BACKEND_METHOD_UNSUPPORTED` surfaces show warning (not crash)
- [ ] Network failure mid-operation → error state, recovers

**RTL**
- [ ] Arabic language switch → layout flips correctly
- [ ] Tested on real Android device (Chrome)
- [ ] Tested on real iOS device (Safari)

**Acceptance:** All items checked. Signed in `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`.

---

## BLOCKER 3 — Customer Deployment Guide

File `docs/CUSTOMER_DEPLOYMENT_GUIDE.md` does not yet exist.

Must cover:
1. Creating a Supabase project (with screenshots)
2. Applying the schema SQL
3. Creating first admin user + center
4. Deploying the web app (Vercel env vars or self-hosted nginx)
5. First login walkthrough
6. Adding staff users

---

## V1.0 RELEASE GATE — ALL MUST BE ✅

| Gate | Status |
|---|---|
| `tsc --noEmit` clean | ✅ |
| `vitest run` 74/74 | ✅ |
| `npm run build` clean | ✅ |
| Preview Mode absent from `src/` | ✅ |
| **Supabase project live + preflight passes** | ❌ **Primary blocker** |
| **Full live QA signed off** | ❌ Pending Supabase |
| Arabic RTL device-tested | ❌ Pending |
| `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` signed | ❌ Pending |
| `CUSTOMER_DEPLOYMENT_GUIDE.md` written | ❌ Pending |

---

## OUT OF SCOPE FOR v1.0

> ⚠️ This table is OUTDATED. As of 2026-06-28 the items below are IMPLEMENTED
> in code. They only require a live Supabase project + the migrations in
> `supabase/migrations/` to function. See `docs/PRODUCTION_READINESS.md`.

| Feature | Status (2026-06-28) |
|---|---|
| POS Checkout | ✅ Implemented — RPC `supabase/migrations/20260628000003_checkout_rpc.sql` |
| Invoice print | ✅ Implemented — `getForPrint` + `InvoicePrintLayout` + reprint |
| Financial dashboard (P&L, revenue) | ✅ Implemented — real `invoices`/`expenses` queries |
| Sales reports | ✅ Implemented — `ReportAdapter` real queries |
| Customer visit history | ✅ Implemented — `Customer.getHistory` |
| Settings mutations | ✅ Implemented — `Settings.update` |
| Expense edit UI | ✅ Implemented — edit flow in `ExpensesPage` |
| Settings restore | ✅ Implemented — `Settings.restore` (upsert, center-scoped) |
| Bundle code-split | ✅ Implemented — `manualChunks` in `vite.config.ts` |

---

## TIMELINE

| Step | Effort | Owner |
|---|---|---|
| Supabase setup + schema + seed | 1 hour | DevOps / DBA |
| Preflight + boot verification | 30 min | Engineer |
| Full live QA | 4–6 hours | QA |
| Bug fixes if found | 2–4 hours | Engineer |
| Write deployment guide | 3–4 hours | Engineer + PM |
| Arabic RTL device test | 2 hours | QA |
| Sign-off | 30 min | Owner |
| **Total** | **~2 weeks calendar** | Cross-functional |

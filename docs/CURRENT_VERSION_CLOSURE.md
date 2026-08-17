# CURRENT VERSION CLOSURE — staff-only release

> **Historical snapshot (2026-08-09):** this document froze the state at the
> staff-only closure (18 migrations, 245 tests). The canonical chain has grown
> since then (financial entitlements, checkout idempotency, integrity
> hardening). Use `PRODUCTION_READINESS.md`, `OPERATIONAL_DATA_CONTRACT.md`,
> and the current audit artifacts for the repository contract.

**Release definition:** Single-customer, single-center Supabase PWA. Real auth. Real CRUD. Staff-only (no public booking, no customer portal). No fake mode.
**Primary gate:** Live Supabase connection must be established before any customer receives this product.

---

## WHAT IS ALREADY DONE ✅

| Item | Evidence |
|---|---|
| Preview Mode removed | `BackendMode = "supabase"` only · `src/infrastructure/preview/` deleted · `UserRole.PREVIEW` absent |
| Staff-only closure | `20260809000001_delivery_security_hardening.sql` revokes anon EXECUTE from every SECURITY DEFINER routine |
| Public routes removed | `src/routes.tsx` — `/book` and `/portal` routes deleted; staff-side portal distribution UI removed |
| Hard config guard | `parseEnv()` throws `EnvironmentConfigurationError` on missing/invalid env |
| All core CRUD adapters | Implemented in `src/infrastructure/supabase/repositories.ts` |
| TypeScript clean | `tsc --noEmit` → 0 errors (verified 2026-08-09) |
| Tests passing | `vitest run` → **245/245** (verified 2026-08-09) |
| Build passing | `npm run build` → clean PWA (verified 2026-08-09) |
| Canonical schema | `supabase/migrations/` — 18 ordered files, validated by `npm run preflight:supabase` |
| QA runbook written | `docs/SUPABASE_LIVE_QA_RUNBOOK.md` |
| Preflight script | `npm run preflight:supabase` (checks all 18 migrations + env contract) |
| Delivery guide | `docs/DELIVERY-GUIDE.md` (canonical migration path + owner PWA install guide) |
| Acceptance checklist | `docs/MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` |
| Legacy bootstrap scripts archived | `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` + `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` moved to `docs/archive/` |

---

## MANDATORY GATE — SUPABASE CONNECTION

**This gate must pass before any other release activity.**
Estimated time: 45–60 minutes (one sitting).

### Step 1 — Create Supabase Project (5 min)
1. https://supabase.com → New Project.
2. Name: `lenabeauty-[client]` (e.g. `lenabeauty-sara-salon`).
3. Region: Middle East / Frankfurt.
4. Save the DB password.

### Step 2 — Apply the 18 Canonical Migrations (10 min)
Supabase Dashboard → SQL Editor → paste and run each file in `supabase/migrations/` **in filename order**:
`20260623000001_initial_schema.sql` → `...` → `20260809000001_delivery_security_hardening.sql`.
Do not use the archived `docs/archive/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` / `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql`.

Verify: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
Expected includes: `appointments, attendance_records, centers, center_memberships, customers, employees, expenses, gift_cards, invoices, payroll_runs, products, profiles, service_packages, services`.

### Step 3 — Create Admin User + Bootstrap (5 min)
1. Authentication → Users → Add user: admin email + strong password.
2. Copy the new user UUID.
3. In SQL Editor: open `supabase/migrations/20260628000002_admin_bootstrap.sql`, set `v_admin_uid` to that UUID, run it.

### Step 4 — Configure Environment (5 min)
Vercel dashboard env vars (not `vercel.json`):
```
VITE_DATA_BACKEND=supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
VITE_CENTER_ID=7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d   # seed center UUID from migration 1
VITE_BRANCH_MODE=single
```

### Step 5 — Run Preflight (5 min)
```bash
npm run preflight:supabase
```
All checks must pass.

### Step 6 — Boot Verification (10 min)
- Login page loads (no config errors).
- Login with admin credentials → dashboard appears.
- Page refresh → session restored.
- Logout → redirected to login.

**Acceptance:** All checks pass. Supabase connection is live.

---

## BLOCKER 2 — Full Live Browser QA

Follow `docs/SUPABASE_LIVE_QA_RUNBOOK.md` completely. Summary:

**Auth**
- [ ] ADMIN login / session restore / logout
- [ ] STAFF login — blocked from admin-guarded routes (`/reports`, `/settings`, `/accounting`, `/branding`)
- [ ] Wrong credentials → error, not crash

**Core CRUD — each must persist on page reload**
- [ ] Customers: create, read, update, delete
- [ ] Appointments: create, read, update (status), delete
- [ ] Services: create, read, update, delete
- [ ] Employees: create, read, update, delete
- [ ] Products: create, read, update, delete (stock changes on checkout)
- [ ] Expenses: create, read, edit, delete

**Billing & loyalty**
- [ ] POS checkout completes (invoice + stock + loyalty + tier discount)
- [ ] Gift-card issue and redemption during checkout
- [ ] Package create and sell during checkout
- [ ] Invoice print preview renders

**Staff ops**
- [ ] Attendance records persist
- [ ] Advances persist
- [ ] Payroll run persists

**Dashboard & Reports**
- [ ] Operational counts show real numbers
- [ ] Appointment / inventory / sales / financial reports render real data

**Backup**
- [ ] Settings → Data & Backup export/restore round-trip

**Error handling**
- [ ] Network failure mid-operation → error state, recovers
- [ ] No anonymous page reachable (`/book`, `/portal` redirect to login)

**RTL**
- [ ] Arabic language switch → layout flips correctly
- [ ] Tested on real Android device (Chrome)
- [ ] Tested on real iOS device (Safari)

**Acceptance:** All items checked. Signed in `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`.

---

## RELEASE GATE — ALL MUST BE ✅

| Gate | Status |
|---|---|
| `tsc --noEmit` clean | ✅ (verified) |
| `vitest run` 245/245 | ✅ (verified) |
| `npm run build` clean PWA | ✅ (verified) |
| Preview / anonymous mode absent | ✅ |
| Staff-only closure (routes + anon RPCs) | ✅ |
| **Supabase project live + 18 migrations applied** | ❌ **Primary blocker** |
| **Full live QA signed off** | ❌ Pending Supabase |
| **Leaked publishable key rotated** | ❌ Owner action (git history) |
| Arabic RTL device-tested | ❌ Pending |
| `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` signed | ❌ Pending |

---

## OUT OF SCOPE FOR THIS RELEASE

| Feature | Status |
|---|---|
| Public online booking (`/book`) | ❌ staff-only release (routes removed, anon RPCs revoked) |
| Customer portal (`/portal`) | ❌ staff-only release (routes removed, anon RPCs revoked) |
| Staff self-service account creation | ❌ provisioned by developer via Supabase + SQL |
| WhatsApp / notification delivery | ⚠️ settings scaffolding; needs WhatsApp Business API creds |
| Desktop EXE (Tauri) | ⚠️ separate future track; Web/PWA is the delivery target |

---

## TIMELINE

| Step | Effort | Owner |
|---|---|---|
| Supabase setup + 18 migrations + admin bootstrap | 1 hour | DevOps / DBA |
| Preflight + boot verification | 30 min | Engineer |
| Full live QA | 4–6 hours | QA |
| Bug fixes if found | 2–4 hours | Engineer |
| Key rotation (leaked publishable key) | 15 min | Owner |
| Arabic RTL device test | 2 hours | QA |
| Sign-off | 30 min | Owner |
| **Total** | **~1–2 weeks calendar** | Cross-functional |

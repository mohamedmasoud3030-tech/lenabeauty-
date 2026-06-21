# CURRENT VERSION CLOSURE — v1.0
**Release definition:** Single-customer, single-center Supabase PWA. Real auth. Real CRUD. Live QA verified. No fake mode.  
**Code status:** ✅ Ready — all blockers are operational, not technical.

---

## WHAT IS ALREADY DONE (verified from source)

| Item | Evidence |
|---|---|
| Preview Mode removed | `BackendMode = "supabase"` only in `env.ts` · `src/infrastructure/preview/` deleted · `UserRole.PREVIEW` absent · Login page has no preview button |
| Configuration guard | `parseEnv()` throws `EnvironmentConfigurationError` on missing/invalid config |
| Core CRUD adapters | All 11 domain port interfaces implemented in `SupabaseAdapter` (repositories.ts) |
| TypeScript clean | `tsc --noEmit` → 0 errors |
| Tests passing | `vitest run` → 74/74 |
| Build passing | `npm run build` → clean PWA |
| Supabase schema written | `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` finalized |
| QA runbook written | `docs/SUPABASE_LIVE_QA_RUNBOOK.md` exists |
| Preflight script | `npm run preflight:supabase` validates env before QA |
| Acceptance checklist | `docs/MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` exists |

---

## REMAINING BLOCKERS (operational — not code)

### BLOCKER 1 — No live Supabase environment exists
**This is the only real blocker for v1.0.**

Steps required (est. 45 minutes total):

1. **Create Supabase project** — https://supabase.com → New Project → choose MENA-closest region (e.g. `eu-south-1`)
2. **Apply base schema** — SQL Editor → paste `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` → Run
3. **Create admin user** — Authentication → Users → Add User (email + password, no invite)
4. **Create center row:**
   ```sql
   INSERT INTO public.centers (id, name, currency, center_type)
   VALUES (gen_random_uuid(), 'Test Salon', 'SAR', 'salon')
   RETURNING id;
   ```
5. **Link user to center:**
   ```sql
   INSERT INTO public.center_memberships (user_id, center_id, role)
   VALUES ('<user-id-from-auth>', '<center-id-from-above>', 'ADMIN');
   ```
6. **Configure `.env.local`** (NOT committed to Git):
   ```
   VITE_DATA_BACKEND=supabase
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
   VITE_CENTER_ID=<uuid-from-step-4>
   VITE_BRANCH_MODE=single
   ```
7. **Run preflight:**
   ```bash
   npm run preflight:supabase
   ```

**Acceptance:** Preflight passes. App boots. Login works.

---

### BLOCKER 2 — Live browser QA not performed

Follow `docs/SUPABASE_LIVE_QA_RUNBOOK.md` exactly. Summary of scope:

**Auth**
- [ ] Login (ADMIN) → dashboard
- [ ] Login (STAFF) → dashboard, blocked from `/reports` and `/settings`
- [ ] Session restored on page refresh
- [ ] Logout clears session

**Core CRUD (each must persist on reload)**
- [ ] Customer: create, read, update, delete
- [ ] Appointment: create, read, update, delete
- [ ] Service: create, read, update, delete
- [ ] Employee: create, read, update, delete
- [ ] Product: create, read, update, delete
- [ ] Expense: create, read, delete

**Dashboard**
- [ ] Operational counts (customers, appointments, products) show real numbers
- [ ] Financial metrics show "Backend Required" message — not crash

**Reports**
- [ ] Appointments report renders real data
- [ ] Inventory report renders real data
- [ ] Sales report shows "Backend Required" — not crash

**Error handling**
- [ ] Network loss mid-operation → error state, not crash
- [ ] All `BACKEND_METHOD_UNSUPPORTED` surfaces show localized warning

**RTL**
- [ ] Arabic language switch → layout flips, no overflow
- [ ] Tested on real Android device
- [ ] Tested on real iOS device

**Acceptance:** All items above checked off by a human. Signed in `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md`.

---

### BLOCKER 3 — Customer deployment guide missing

Customers cannot self-onboard without documentation. File `docs/CUSTOMER_DEPLOYMENT_GUIDE.md` does not yet exist.

**Must cover:**
1. How to create a Supabase project
2. How to apply the schema SQL
3. How to create the first admin user
4. How to deploy the web app (Vercel env vars or self-hosted)
5. How to configure `VITE_CENTER_ID`
6. First login walkthrough

---

## V1.0 RELEASE GATE — ALL MUST BE ✅

| Gate | Status |
|---|---|
| `tsc --noEmit` clean | ✅ Already passing |
| `vitest run` 74/74 | ✅ Already passing |
| `npm run build` clean | ✅ Already passing |
| Preview Mode absent from `src/` | ✅ Already done |
| Supabase base schema applied to staging | ❌ Pending |
| Preflight passes against staging | ❌ Pending |
| Live browser QA checklist signed off | ❌ Pending |
| Arabic RTL device-tested | ❌ Pending |
| `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` signed | ❌ Pending |
| `CUSTOMER_DEPLOYMENT_GUIDE.md` written | ❌ Pending |

---

## OUT OF SCOPE FOR v1.0 (deferred to v1.1)

| Feature | Reason |
|---|---|
| POS Checkout | Requires `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` applied to DB |
| Invoice print | Same dependency |
| Financial dashboard (P&L, revenue) | Same dependency |
| Sales reports | Same dependency |
| Customer visit history | Same dependency |
| Settings mutations (logo, update, backup) | Not yet implemented in adapter |
| Expense edit UI | Contract exists; UI is v1.1 |
| Bundle code-split | Performance, not correctness |

---

## TIMELINE ESTIMATE

| Step | Effort | Owner |
|---|---|---|
| Supabase setup + schema + seed | 1 hour | DevOps / DBA |
| Preflight + app boot verification | 30 min | Engineer |
| Full live QA | 4–6 hours | QA |
| Bug fixes (if any found) | 2–4 hours | Engineer |
| Write deployment guide | 3–4 hours | Engineer + PM |
| Arabic device test | 2 hours | QA |
| Sign-off | 30 min | Owner |
| **Total** | **~2 weeks calendar** | Cross-functional |

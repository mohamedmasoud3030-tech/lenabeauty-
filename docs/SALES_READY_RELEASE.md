# SALES-READY RELEASE — Definition & Criteria
**Product:** SPA Management App  
**Rule:** The product is not sales-ready while any fake operating mode is reachable, while live CRUD is unverified, or while the deployment path is undocumented.

---

## DEFINITION

> Sales-ready means: a new customer can be onboarded, their real data persists, their staff can operate the system, and the experience depends on zero fake data, zero fake sessions, and zero unverified features.

---

## WHAT "SALES-READY" IS NOT

| ❌ Not acceptable | Reason |
|---|---|
| App builds and tests pass | Necessary but not sufficient |
| App looks good in any fake/demo mode | Preview Mode is removed — no such mode exists |
| Features that are not built described as "coming soon" without prior disclosure | Must disclose to buyer before purchase |
| Manual QA skipped | Untested live behavior is not sales-ready |

---

## CRITERION 1 — No Fake Operating Mode

**Status: ✅ Achieved in code**

| Check | Verified |
|---|---|
| `VITE_DATA_BACKEND` only accepts `"supabase"` | ✅ `env.ts` line 8: `type BackendMode = "supabase"` |
| Missing env → hard error screen | ✅ `parseEnv()` throws `EnvironmentConfigurationError` |
| `UserRole.PREVIEW` does not exist | ✅ Absent from `Session.ts` |
| "Enter Preview Mode" button absent | ✅ Removed from `LoginPage.tsx` |
| Preview adapter directory absent | ✅ `src/infrastructure/preview/` deleted |
| Amber preview banner absent | ✅ Removed from `route-guards.tsx` |

---

## CRITERION 2 — Real Authentication Works

**Status: ❌ Pending live QA**

| Check | Status |
|---|---|
| Login with ADMIN credentials succeeds | ❌ Not tested against live Supabase |
| Login with STAFF credentials succeeds | ❌ Not tested |
| STAFF blocked from `/reports`, `/settings` | ❌ Not tested |
| Session persists on page refresh | ❌ Not tested |
| Logout clears session | ❌ Not tested |
| Incorrect credentials → error (no crash) | ❌ Not tested |

---

## CRITERION 3 — Real Data Persistence Works

**Status: ❌ Pending live QA**

All operations must complete against real Supabase and survive page reload.

| Module | Operations | Status |
|---|---|---|
| Customers | C / R / U / D | ❌ Not live-tested |
| Appointments | C / R / U / D | ❌ Not live-tested |
| Services | C / R / U / D | ❌ Not live-tested |
| Employees | C / R / U / D | ❌ Not live-tested |
| Products | C / R / U / D | ❌ Not live-tested |
| Expenses | C / R / D | ❌ Not live-tested |
| Dashboard operational counts | R | ❌ Not live-tested |
| Appointment report | R | ❌ Not live-tested |
| Inventory report | R | ❌ Not live-tested |

---

## CRITERION 4 — Blocked Features Disclosed Before Sale

For v1.0, the following features are intentionally incomplete. The buyer must know before purchase.

| Feature | v1.0 Status | Disclosure required |
|---|---|---|
| POS Checkout / Billing | Not functional | Yes |
| Invoice printing | Not functional | Yes |
| Financial dashboard (P&L, revenue) | Not functional | Yes |
| Sales reports | Not functional | Yes |
| Customer visit history | Not functional | Yes |
| Settings mutations (name, logo, backup) | Not functional | Yes |
| Expense editing | Not functional | Yes |

The UI shows "Backend Required" warnings for these. That is necessary but not sufficient — the sales conversation must set expectations before evaluation.

---

## CRITERION 5 — Data Isolation Verified

**Status: ❌ Pending live QA**

RLS policies are defined in schema but not yet tested against a live Supabase instance.

| Check | Status |
|---|---|
| RLS policies exist in `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` | ✅ |
| `VITE_CENTER_ID` mismatch → `UNAUTHORIZED_CENTER_MEMBERSHIP` error | ✅ Implemented in `AppContext.tsx` |
| User from Center A cannot read Center B data (live test) | ❌ Not tested |

For v1.0 (single-center, single-customer), cross-tenant isolation is still a production safety requirement — not just a SaaS concern.

---

## CRITERION 6 — Backup & Recovery Path Defined

**v1.0 (Supabase-hosted):**
- Supabase Pro plan provides automated daily backups
- Manual export: Settings → Export Data (`BACKEND_METHOD_UNSUPPORTED` in v1.0 — ships in v1.1)
- Customer deployment guide must document: "Your data is stored in Supabase and backed up daily"

**v2.0 (Desktop EXE — future):**
- Backup = copy of local SQLite `.db` file
- Restore = replace `.db` file from backup
- Both built into the application

---

## CRITERION 7 — Deployment Path Documented

**Status: ❌ `docs/CUSTOMER_DEPLOYMENT_GUIDE.md` not yet written**

Required content:
1. Create a Supabase project
2. Apply `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql`
3. Create first admin user
4. Create center row + membership
5. Deploy the web app (Vercel or self-hosted)
6. Set environment variables
7. First login walkthrough
8. How to add staff users

---

## CRITERION 8 — Arabic RTL Device-Tested

**Status: ❌ Not tested on physical devices**

| Check | Status |
|---|---|
| Arabic RTL layout on Android (Chrome) | ❌ Pending |
| Arabic RTL layout on iOS (Safari) | ❌ Pending |
| Arabic font rendering (no tofu/boxes) | ❌ Pending |
| RTL direction in modals, drawers, forms | ❌ Pending |

---

## SALES-READY GATE (v1.0)

All must be ✅ before first paying customer:

**Technical**
- [x] Preview Mode removed from source ✅
- [ ] Supabase staging environment created and schema applied
- [ ] Preflight passes (`npm run preflight:supabase`)
- [ ] Full live browser QA passed (`SUPABASE_LIVE_QA_RUNBOOK.md`)
- [ ] RLS cross-center isolation tested
- [ ] `tsc --noEmit` clean ✅
- [ ] `vitest run` 74/74 ✅
- [ ] `npm run build` success ✅

**Documentation**
- [ ] `CUSTOMER_DEPLOYMENT_GUIDE.md` written and reviewed
- [ ] `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` signed off
- [ ] v1.0 feature scope disclosed in sales materials

**Quality**
- [ ] Arabic RTL tested on Android + iOS
- [ ] Error states tested (network failure, bad auth, missing env)
- [ ] No crashes observed during QA session

---

## V1.0 — WHAT CAN BE SOLD

**Core management features (verified in code, QA pending):**
- Complete customer management (CRM)
- Appointment scheduling and status tracking
- Service catalog management
- Employee management and scheduling
- Product/inventory catalog
- Expense tracking
- Operational reports (appointments booked, inventory levels)
- Real-time operational dashboard
- Role-based access (Admin vs Staff)
- Arabic + English bilingual interface

**Honest positioning:** v1.0 is the **operational backbone** of the salon — scheduling, staffing, catalog, and inventory. Billing and financial reporting arrive in v1.1.

---

## SALES-READY GATE (v2.0 — Desktop EXE)

Same criteria as above, plus:

- [ ] Windows 10 + Windows 11 installer QA passed
- [ ] Offline operation verified (zero internet required)
- [ ] Arabic RTL in WebView2 verified
- [ ] Backup/restore round-trip tested
- [ ] Auto-update works
- [ ] Code-signed EXE (no SmartScreen warning)
- [ ] All SQLite adapters tested to same standard as Supabase adapters

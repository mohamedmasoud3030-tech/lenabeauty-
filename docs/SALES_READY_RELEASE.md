# SALES-READY RELEASE — Definition & Criteria
**Updated:** 2026-08-09
**Rule:** The product is not delivered to any customer — paid or pilot — until a live Supabase connection is established and QA-verified.

---

## DEFINITION

> Sales-ready means: a live Supabase project is connected with the canonical migration chain applied, a real admin user can log in, all implemented CRUD and POS operations persist real data, no anonymous/fake mode is reachable, and the customer has a deployment guide they can follow.

---

## DELIVERY PREREQUISITE — SUPABASE MUST BE LIVE

**This supersedes all other criteria.** The product must not be shown, demoed, or delivered in any state where data does not persist to a real Supabase database.

| Why | Detail |
|---|---|
| No fallback mode | The app requires a real Supabase connection to function |
| Trust | A customer who sees fake or empty data cannot evaluate the product honestly |
| Data safety | Untested RLS in a live environment is a data breach risk |
| Support | Delivering without a verified connection creates unresolvable support tickets |

---

## CRITERION 1 — No Fake / Anonymous Operating Mode ✅ ACHIEVED

| Check | Verified |
|---|---|
| `BackendMode = "supabase"` only | ✅ `env.ts` |
| Missing env → `EnvironmentConfigurationError` | ✅ `parseEnv()` throws |
| `UserRole.PREVIEW` absent | ✅ `Session.ts` |
| "Enter Preview Mode" button absent | ✅ `LoginPage.tsx` |
| `src/infrastructure/preview/` deleted | ✅ |
| Public `/book` + `/portal` routes removed | ✅ `routes.tsx` (staff-only release) |
| Anonymous RPC EXECUTE revoked | ✅ `20260809000001_delivery_security_hardening.sql` |

---

## CRITERION 2 — Live Supabase Connection Verified ❌ PENDING

**This is the primary blocker.**

| Check | Status |
|---|---|
| Supabase project created | ❌ |
| 18 canonical migrations applied in order | ❌ |
| Admin user created and linked via `admin_bootstrap.sql` | ❌ |
| `.env` configured (Vercel dashboard) | ❌ |
| `npm run preflight:supabase` passes | ❌ |
| Login succeeds with real credentials | ❌ |

See `docs/DELIVERY-GUIDE.md` for the exact steps.

---

## CRITERION 3 — Real Data Persistence Verified ❌ PENDING

All operations must complete against real Supabase and survive page reload.

| Module | Create | Read | Update | Delete |
|---|---|---|---|---|
| Customers / Appointments / Services / Employees / Products | ❌ | ❌ | ❌ | ❌ |
| Expenses | ❌ | ❌ | ❌ (v1.0 has edit) | ❌ |
| POS checkout (invoice + stock + loyalty + gift card) | ❌ | — | — | — |
| Packages sell | ❌ | — | — | — |
| Attendance / Advances / Payroll | ❌ | ❌ | ❌ | — |
| Dashboard counts / Reports / Financial metrics | — | ❌ | — | — |
| Backup export / restore | — | ❌ | — | — |

---

## CRITERION 4 — Auth & Role Separation Verified ❌ PENDING

| Check | Status |
|---|---|
| ADMIN login works | ❌ |
| STAFF login works | ❌ |
| STAFF blocked from `/reports`, `/settings`, `/accounting`, `/branding` | ❌ |
| Session persists on page refresh | ❌ |
| Wrong credentials → error (not crash) | ❌ |

---

## CRITERION 5 — Feature Scope Disclosed Before Sale ⚠️

The buyer must know what the release includes and excludes.

| Feature | Release |
|---|---|
| Customer / Appointment / Service / Employee / Product management | ✅ |
| Expense tracking (create/edit/delete) | ✅ |
| Operational dashboard + reports (appointment, inventory, sales, financial) | ✅ |
| POS checkout + invoice printing | ✅ |
| Gift cards (issue/redeem) + service packages (create/sell) | ✅ |
| Attendance, advances, payroll | ✅ |
| Backup export/restore + settings (logo, name) | ✅ |
| **Public online booking** | ❌ staff-only release |
| **Customer portal (phone+code login)** | ❌ staff-only release |
| **Staff self-service account creation** | ❌ provisioned by developer |

---

## CRITERION 6 — Data Isolation Verified ❌ PENDING

| Check | Status |
|---|---|
| RLS policies in migrations (18-file chain) | ✅ Defined |
| `center_id` mismatch → `UNAUTHORIZED_CENTER_MEMBERSHIP` | ✅ Implemented in `AppContext.tsx` |
| Cross-center read blocked (live test) | ❌ Not yet tested |

---

## CRITERION 7 — Deployment Path Documented ✅ ACHIEVED

`docs/DELIVERY-GUIDE.md` covers: Supabase project creation, applying the 18 canonical migrations, admin bootstrap, Vercel env vars, preflight, and the owner install guide (PWA install on iOS/Android/desktop).

---

## CRITERION 8 — Arabic RTL Device-Tested ❌ PENDING

| Check | Status |
|---|---|
| Layout correct on Android (Chrome) / iOS (Safari) | ❌ |
| No text overflow or cut-off | ❌ |
| Forms and modals work in RTL | ❌ |

---

## SALES-READY GATE CHECKLIST

**All must be ✅ before first customer delivery:**

```
Technical:
[x] No fake/anonymous operating mode
[x] tsc --noEmit → 0 errors
[x] vitest run → 245/245
[x] npm run build → clean PWA
[ ] Supabase project live + 18 migrations applied     ← PRIMARY BLOCKER
[ ] npm run preflight:supabase passes
[ ] Login works with real credentials
[ ] Full live QA (SUPABASE_LIVE_QA_RUNBOOK.md) signed off
[ ] RLS cross-center isolation tested
[ ] Leaked publishable key rotated (git history)

Documentation:
[x] DELIVERY-GUIDE.md written and current
[ ] MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md signed
[x] Feature scope communicated to buyer

Quality:
[ ] Arabic RTL tested on Android + iOS
[ ] Error states tested (network failure, bad credentials)
[ ] No crashes in QA session
```

---

## RELEASE POSITIONING

**What the release is:** The staff-only operational backbone of a salon — scheduling, catalog, inventory, POS billing, gift cards, packages, attendance/payroll, and reporting. All core management features are real and data-persisted.

**What the release is not:** A public-facing booking/customer-portal product, or a self-service account-management product. Those are future releases.

---

## V2.0 DESKTOP EXE — FUTURE GATE

Same criteria as above, plus:

- [ ] Windows 10 + 11 installer QA passed
- [ ] Offline operation verified (zero internet required)
- [ ] Arabic RTL in WebView2 verified
- [ ] Backup/restore round-trip tested
- [ ] Auto-update works
- [ ] EXE is code-signed (no SmartScreen warning)

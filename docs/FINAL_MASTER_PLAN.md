# FINAL MASTER PLAN — SPA Management App
**Branch:** docs-v1-v2-v3-source-of-truth  
**Verified from:** `origin/main` commit 617b883 (live clone, June 2026)  
**Roles:** Senior Product Architect · Full-Stack Auditor · Release Planning Engineer

---

## LOCKED PRODUCT DECISIONS

| # | Decision | Status |
|---|---|---|
| 1 | Preview Mode is **removed from the product entirely** — not toggled, not hidden, not valid as demo/fallback | ✅ Done in code (commit 3b60967) |
| 2 | Missing configuration must produce a **hard blocking error screen**, not a fallback | ✅ `parseEnv()` throws `EnvironmentConfigurationError` |
| 3 | `VITE_DATA_BACKEND=supabase` is the only valid backend mode | ✅ `BackendMode = "supabase"` in `env.ts` |
| 4 | v1.0 = single-customer, single-center Supabase PWA | On track |
| 5 | v1.1 = checkout, print, financial reports, settings mutations, expense edit UI, performance | Planned |
| 6 | v2.0 = Windows Desktop EXE via Tauri v2 + SQLite — **documented only, not implemented** | Future |
| 7 | Sales-ready = real auth + real CRUD + live QA verified — no fake mode | Pending QA |

---

## BUILD HEALTH — VERIFIED FROM SOURCE

| Check | Command | Result |
|---|---|---|
| TypeScript compile | `tsc --noEmit` | ✅ 0 errors |
| Tests | `vitest run` | ✅ 74/74 passed (8 files) |
| Production build | `npm run build` | ✅ Clean PWA output |
| Bundle warning | build output | ⚠️ 1,325 kB single chunk — code-split in v1.1 |
| Live browser QA | (not performed) | ❌ PENDING — blocking v1.0 release |

---

## ARCHITECTURE (verified)

| Aspect | Detail |
|---|---|
| Stack | React 19 · TypeScript 5.8 · Vite 6 · Tailwind 4 · Supabase JS 2 · react-router v7 · i18next · Recharts · Vitest |
| Pattern | Clean Architecture: Domain Ports → Infrastructure Adapters → Use Cases → React Pages |
| Auth | Supabase Auth only. Roles: `ADMIN` / `STAFF` / `MANAGER` |
| Languages | English + Arabic RTL (i18next, ~600+ string keys) |
| Multi-branch | Hard-blocked by design (`VITE_BRANCH_MODE=multi` rejected) |
| Preview Mode | ✅ Completely removed from `src/` |

---

## FEATURE STATUS (from source inspection)

### Core CRUD — Code Complete

| Module | C | R | U | D | Live QA |
|---|---|---|---|---|---|
| Customers | ✅ | ✅ | ✅ | ✅ | ❌ Pending |
| Appointments | ✅ | ✅ | ✅ | ✅ | ❌ Pending |
| Services | ✅ | ✅ | ✅ | ✅ | ❌ Pending |
| Employees | ✅ | ✅ | ✅ | ✅ | ❌ Pending |
| Products (Inventory) | ✅ | ✅ | ✅ | ✅ | ❌ Pending |
| Expenses | ✅ | ✅ | ⚠️ stub | ✅ | ❌ Pending |

> **Expense.update:** Domain port and adapter exist. Adapter returns `BACKEND_METHOD_UNSUPPORTED`. Edit UI is v1.1 work.

### Financial & POS — Code Complete, DB Schema Pending

| Feature | Adapter | Status |
|---|---|---|
| Invoice.checkout | `SupabaseInvoiceAdapter.checkout` line 689 | ✅ Code done — requires Phase 10B SQL applied to DB |
| Invoice.getForPrint | `SupabaseInvoiceAdapter.getForPrint` line 731 | ✅ Code done — requires Phase 10B SQL |
| Dashboard.getPnlMonth | line 977 | ✅ Code done — requires Phase 10B SQL |
| Dashboard.getRevenueLast7Days | line 1017 | ✅ Code done — requires Phase 10B SQL |
| Report.getSales | line 1055 | ✅ Code done — requires Phase 10B SQL |
| Customer.getHistory | line 244 | ✅ Code done — requires Phase 10B SQL |

### Settings — Not Yet Implemented

`Settings.update`, `uploadLogo`, `exportData`, `backup`, `restore` — all return `BACKEND_METHOD_UNSUPPORTED`. Deferred to v1.1.

---

## DATABASE SCHEMA STATUS

| File | Purpose | Status |
|---|---|---|
| `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` | v1.0 base tables + RLS | ✅ Final — **not yet applied to production** |
| `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` | invoices + invoice_items + process_checkout_v1 RPC | ✅ Final — **not yet applied to production** |
| `docs/SUPABASE_STAGING_SEED_10A5.sql` | Staging seed data for QA | ✅ Ready |

**Critical:** Neither SQL file has been applied to a real Supabase project yet. This is the primary blocker for v1.0.

---

## PHASE MODEL (locked)

```
v1.0  ──  Single-customer Supabase PWA
          Real auth · Real CRUD · Live QA verified
          Preview Mode: REMOVED ✅
          Status: Code ready — awaiting DB + QA

v1.1  ──  Financial layer + Performance
          Checkout · Print · Reports · Settings mutations
          Expense edit UI · Bundle code-split
          Status: Code ready — awaiting v1.0 release

v2.0  ──  Windows Desktop EXE
          Tauri v2 + SQLite · Offline-first
          Local auth · Local migrations · Backup/restore
          Status: Documented only — do not implement yet
```

---

## TECH DEBT (verified from source)

| Item | Severity | Phase |
|---|---|---|
| `Expense.update` UI missing (contract exists) | Medium | v1.1 |
| Single JS bundle 1,325 kB | Medium | v1.1 code-split |
| `sendReminder` is a silent stub returning `ok: true` | Low | v1.1 — implement or remove |
| `getActivityFeed` returns hardcoded `[]` | Low | v1.1 |
| Several page-level form states typed as `any` | Low | v1.1 cleanup |

---

## IMMEDIATE NEXT ACTIONS

| # | Action | Blocks |
|---|---|---|
| 1 | Create staging Supabase project | All live QA |
| 2 | Apply `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` | v1.0 core QA |
| 3 | Configure `.env.local` with staging credentials | App boot |
| 4 | Run `npm run preflight:supabase` | QA readiness |
| 5 | Execute `SUPABASE_LIVE_QA_RUNBOOK.md` | v1.0 release gate |
| 6 | Write `CUSTOMER_DEPLOYMENT_GUIDE.md` | Sales handoff |
| 7 | Arabic RTL test on real Android + iOS device | v1.0 acceptance |
| 8 | Sign off `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` | v1.0 release |
| 9 | Apply `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` | v1.1 start |

---

*All facts verified from live repository clone. No content inferred from session summaries.*

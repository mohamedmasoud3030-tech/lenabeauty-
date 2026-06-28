# FINAL MASTER PLAN — SPA Management App
**Branch:** docs-v1-v2-v3-source-of-truth  
**Verified from:** `origin/main` commit 69e0118 (June 2026)  
**Roles:** Senior Product Architect · Full-Stack Auditor · Release Planning Engineer

---

## LOCKED PRODUCT DECISIONS

| # | Decision | Status |
|---|---|---|
| 1 | Preview Mode **completely removed** — not toggled, not hidden, not valid as demo/fallback | ✅ Done |
| 2 | Missing configuration → **hard blocking error screen**, not fallback | ✅ Done |
| 3 | **Live Supabase connection is mandatory before any version is delivered** | 🔴 Gate |
| 4 | v1.0 = single-customer, single-center Supabase PWA | Pending QA |
| 5 | v1.1 = checkout, print, financial reports, settings mutations, expense edit, code-split | ✅ Implemented (2026-06-28) — checkout RPC migration shipped; needs live QA |
| 6 | v2.0 = Windows Desktop EXE via Tauri v2 + SQLite — **documented only, not implemented** | Future |
| 7 | Sales-ready = real auth + real CRUD + live Supabase QA verified — no fake mode | Pending |

---

## BUILD HEALTH (verified from source)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `vitest run` | ✅ 74/74 passed |
| `npm run build` | ✅ Clean PWA output |
| Bundle size | ⚠️ 1,325 kB single chunk — code-split in v1.1 |
| Live Supabase QA | ❌ PENDING — primary delivery gate |

---

## SUPABASE CONNECTION — MANDATORY DELIVERY GATE

**No version is delivered to any customer until a live Supabase connection is established and QA verified.**

This is not a soft recommendation. It is the primary release gate for v1.0.

### What "connected" means

| Requirement | Status |
|---|---|
| Supabase project created | ❌ Pending |
| `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` applied | ❌ Pending |
| Admin user created and linked to center | ❌ Pending |
| `.env` configured with real URL + anon key + center UUID | ❌ Pending |
| `npm run preflight:supabase` passes | ❌ Pending |
| App boots, login works, session persists | ❌ Pending |
| Full CRUD QA verified (`SUPABASE_LIVE_QA_RUNBOOK.md`) | ❌ Pending |

---

## ARCHITECTURE (verified from source)

| Aspect | Detail |
|---|---|
| Stack | React 19 · TypeScript 5.8 · Vite 6 · Tailwind 4 · Supabase JS 2 · react-router v7 · i18next · Recharts · Vitest |
| Pattern | Clean Architecture: Domain Ports → Infrastructure Adapters → Use Cases → React Pages |
| Auth | Supabase Auth only. Roles: `ADMIN` / `STAFF` / `MANAGER` |
| Languages | English + Arabic RTL (i18next, ~600+ string keys) |
| Preview Mode | ✅ Completely removed from `src/` |
| Multi-branch | Hard-blocked by design |

---

## FEATURE STATUS (from source inspection)

### Core CRUD — Code Complete, Live QA Pending

| Module | C | R | U | D | Live QA |
|---|---|---|---|---|---|
| Customers | ✅ | ✅ | ✅ | ✅ | ❌ Pending Supabase |
| Appointments | ✅ | ✅ | ✅ | ✅ | ❌ Pending Supabase |
| Services | ✅ | ✅ | ✅ | ✅ | ❌ Pending Supabase |
| Employees | ✅ | ✅ | ✅ | ✅ | ❌ Pending Supabase |
| Products (Inventory) | ✅ | ✅ | ✅ | ✅ | ❌ Pending Supabase |
| Expenses | ✅ | ✅ | ⚠️ UNSUPPORTED | ✅ | ❌ Pending Supabase |

> **Expense.update:** Domain port + adapter exist (returns `BACKEND_METHOD_UNSUPPORTED`). Edit UI is v1.1 work.

### Financial & POS — Code Complete, Phase 10B SQL Pending

| Feature | Adapter line | Status |
|---|---|---|
| `Invoice.checkout` | 689 | ✅ Code done — needs Phase 10B SQL + live QA |
| `Invoice.getForPrint` | 731 | ✅ Code done — needs Phase 10B SQL |
| `Dashboard.getPnlMonth` | 977 | ✅ Code done — needs Phase 10B SQL |
| `Dashboard.getRevenueLast7Days` | 1017 | ✅ Code done — needs Phase 10B SQL |
| `Report.getSales` | 1055 | ✅ Code done — needs Phase 10B SQL |
| `Customer.getHistory` | 244 | ✅ Code done — needs Phase 10B SQL |

### Settings — Not Yet Implemented

`Settings.update`, `uploadLogo`, `exportData`, `backup`, `restore` — all return `BACKEND_METHOD_UNSUPPORTED`. Deferred to v1.1.

---

## DATABASE SCHEMA STATUS

| File | Purpose | Status |
|---|---|---|
| `docs/SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql` | v1.0 base tables + RLS | ✅ Final — **not yet applied** |
| `docs/SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` | invoices + checkout RPC | ✅ Final — v1.1, not yet applied |
| `docs/SUPABASE_STAGING_SEED_10A5.sql` | Staging seed data | ✅ Ready |

---

## PHASE MODEL (locked)

```
v1.0  ── Single-customer Supabase PWA
         ├─ GATE: Live Supabase connection verified  ← MUST HAPPEN FIRST
         ├─ Real auth · Real CRUD · QA signed off
         ├─ Preview Mode: REMOVED ✅
         └─ Code: Ready. Blocker: Supabase setup + QA.

v1.1  ── Financial Layer + Performance
         ├─ Requires: v1.0 released + Phase 10B SQL applied
         ├─ Checkout · Print · Reports · Settings mutations
         ├─ Expense edit UI · Bundle code-split
         └─ All adapter code already written on main.

v2.0  ── Windows Desktop EXE (Offline-First)
         ├─ Requires: v1.1 stable in production
         ├─ Tauri v2 + SQLite · Local auth · Local migrations
         ├─ Backup/restore · Arabic RTL in WebView2
         └─ DO NOT IMPLEMENT NOW — documented only.
```

---

## TECH DEBT (verified)

| Item | Severity | Phase |
|---|---|---|
| `Expense.update` UI missing (contract exists) | Medium | v1.1 |
| Single JS bundle 1,325 kB | Medium | v1.1 |
| `sendReminder` is a silent stub returning `ok: true` | Low | v1.1 |
| `getActivityFeed` returns hardcoded `[]` | Low | v1.1 |

---

## IMMEDIATE NEXT ACTIONS (ordered by priority)

| # | Action | Owner | Blocks |
|---|---|---|---|
| **1** | **Create Supabase project** | DevOps | Everything |
| **2** | **Apply `SUPABASE_BASE_SCHEMA_BOOTSTRAP.sql`** | DBA | v1.0 QA |
| **3** | **Configure `.env.local` + run preflight** | Engineer | App boot |
| **4** | **Execute `SUPABASE_LIVE_QA_RUNBOOK.md`** | QA | v1.0 release |
| 5 | Write `CUSTOMER_DEPLOYMENT_GUIDE.md` | Engineer | Sales handoff |
| 6 | Arabic RTL test on real devices | QA | v1.0 acceptance |
| 7 | Sign off `MANUAL_PRE_SALE_ACCEPTANCE_CHECKLIST.md` | Owner | v1.0 release |
| 8 | Apply `SUPABASE_PHASE_10B_CHECKOUT_ACTIVATION.sql` | DBA | v1.1 start |

---

*All facts verified from live repository clone. No content inferred from session summaries.*

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
